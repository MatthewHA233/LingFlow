# Ubuntu 系统路由配置

将以下内容保存为 `app/api/proxy/python/route.ts`：

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客户端
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // 验证用户身份
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return NextResponse.json({ error: '用户验证失败' }, { status: 401 });
    }

    const { audioUrl, storageFormat = 'json', speechId } = await req.json();
    
    if (!speechId) {
      return NextResponse.json({ error: '缺少speechId参数' }, { status: 400 });
    }

    console.log('收到请求参数:', { audioUrl, storageFormat, speechId });

    // 更新任务状态为处理中
    const { error: updateError } = await supabase
      .from('speech_results')
      .update({ 
        status: 'processing',
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', speechId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('更新任务状态失败:', updateError);
      return NextResponse.json({ error: '更新任务状态失败' }, { status: 500 });
    }

    // 获取Python脚本的绝对路径
    const scriptPath = path.join(process.cwd(), 'app', 'api', 'python', 'speech.py');
    console.log('Python脚本路径:', scriptPath);
    
    // 检查文件是否存在
    const fs = require('fs');
    if (!fs.existsSync(scriptPath)) {
      console.error('Python脚本不存在:', scriptPath);
      return NextResponse.json(
        { error: 'Python脚本文件不存在' },
        { status: 404 }
      );
    }

    // 尝试获取系统Python路径
    let pythonPath = '';
    try {
      // 在Ubuntu系统中查找Python路径
      const { execSync } = require('child_process');
      
      // 首先尝试python3命令
      try {
        pythonPath = execSync('which python3', { encoding: 'utf8' }).trim();
      } catch (e) {
        // 如果python3不存在，尝试python命令
        try {
          pythonPath = execSync('which python', { encoding: 'utf8' }).trim();
        } catch (e) {
          throw new Error('未找到Python安装');
        }
      }

      // 验证Python是否可用
      const versionOutput = execSync(`${pythonPath} --version`, { encoding: 'utf8' });
      console.log('找到Python路径:', pythonPath);
      console.log('Python版本:', versionOutput.trim());

    } catch (error) {
      console.error('获取Python路径失败:', error);
      return NextResponse.json(
        { error: '未找到可用的Python安装，请确保Python已正确安装' },
        { status: 500 }
      );
    }

    // 设置Python环境变量
    const pythonDir = path.dirname(pythonPath);
    const currentPath = process.env.PATH || '';
    const newPath = `${pythonDir}:${currentPath}`;
    
    console.log('执行环境:', {
      workingDir: process.cwd(),
      pythonDir,
      scriptPath,
      pythonPath,
      PATH: newPath
    });

    // 启动Python进程
    const pythonProcess = spawn(pythonPath, [
      scriptPath,
      '--audio_url', audioUrl,
      '--format', storageFormat
    ], {
      env: {
        ...process.env,
        PATH: newPath,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
        PYTHONPATH: path.dirname(scriptPath),
        ALIYUN_AK_ID: process.env.ALIYUN_AK_ID,
        ALIYUN_AK_SECRET: process.env.ALIYUN_AK_SECRET,
        NLS_APP_KEY: process.env.NLS_APP_KEY
      },
      cwd: path.dirname(scriptPath)
    });

    return await new Promise<NextResponse>((resolve, reject) => {
      let result = '';
      let error = '';

      pythonProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        console.log('Python输出:', chunk);
        result += chunk;
      });

      pythonProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        console.error('Python错误:', chunk);
        error += chunk;
      });

      // 设置超时
      const timeout = setTimeout(async () => {
        pythonProcess.kill();
        // 更新任务状态为错误
        await supabase
          .from('speech_results')
          .update({ 
            status: 'error',
            error_message: 'Python脚本执行超时',
            updated_at: new Date().toISOString()
          })
          .eq('id', speechId)
          .eq('user_id', user.id);

        resolve(NextResponse.json(
          { error: 'Python脚本执行超时' },
          { status: 504 }
        ));
      }, 300000); // 5分钟超时

      pythonProcess.on('close', async (code) => {
        clearTimeout(timeout);
        console.log('Python进程退出码:', code);
        
        if (code !== 0) {
          // 更新任务状态为错误
          await supabase
            .from('speech_results')
            .update({ 
              status: 'error',
              error_message: `Python脚本执行失败 (${code}): ${error || '未知错误'}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', speechId)
            .eq('user_id', user.id);

          resolve(NextResponse.json(
            { error: `Python脚本执行失败 (${code}): ${error || '未知错误'}` },
            { status: 500 }
          ));
          return;
        }

        try {
          const jsonResult = JSON.parse(result);
          // 更新任务状态为完成
          await supabase
            .from('speech_results')
            .update({ 
              status: 'completed',
              error_message: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', speechId)
            .eq('user_id', user.id);

          resolve(NextResponse.json(jsonResult));
        } catch (e) {
          // 更新任务状态为错误
          await supabase
            .from('speech_results')
            .update({ 
              status: 'error',
              error_message: `无法解析Python输出: ${result}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', speechId)
            .eq('user_id', user.id);

          resolve(NextResponse.json(
            { error: `无法解析Python输出: ${result}` },
            { status: 500 }
          ));
        }
      });

      pythonProcess.on('error', async (err) => {
        clearTimeout(timeout);
        console.error('Python进程错误:', err);
        
        // 更新任务状态为错误
        await supabase
          .from('speech_results')
          .update({ 
            status: 'error',
            error_message: `Python进程启动失败: ${err.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', speechId)
          .eq('user_id', user.id);

        resolve(NextResponse.json(
          { error: `Python进程启动失败: ${err.message}` },
          { status: 500 }
        ));
      });
    });

  } catch (error: any) {
    console.error('API路由错误:', error);
    
    // 如果有speechId，更新任务状态为错误
    if (error.speechId) {
      await supabase
        .from('speech_results')
        .update({ 
          status: 'error',
          error_message: `处理请求时发生错误: ${error.message}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', error.speechId)
        .eq('user_id', error.userId);
    }

    return NextResponse.json(
      { error: `处理请求时发生错误: ${error.message}` },
      { status: 500 }
    );
  }
}
```

## 主要更改说明

1. Python路径检测
   - 移除了Windows特定的路径检测逻辑
   - 使用 `which` 命令查找Python可执行文件
   - 优先尝试 `python3`，失败后尝试 `python`

2. 环境变量设置
   - 路径分隔符从 `;` 改为 `:`
   - 移除了Windows特定的Scripts目录
   - 移除了shell选项

3. 进程启动
   - 移除了Windows特定的shell选项
   - 使用Unix风格的路径分隔符

4. 文件路径处理
   - 使用path.join确保跨平台兼容性
   - 保持使用正斜杠(/)作为路径分隔符

这些修改确保了代码在Ubuntu系统上能够正常运行，同时保持了主要功能的完整性。 