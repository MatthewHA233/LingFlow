import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { audioUrl, storageFormat = 'json' } = await req.json();
    console.log('收到请求参数:', { audioUrl, storageFormat });

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
      // 首先尝试使用Python安装目录
      const possiblePaths = [
        'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Python\\Python311\\python.exe',
        'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Python\\Python310\\python.exe',
        'C:\\Users\\Administrator\\AppData\\Local\\Programs\\Python\\Python39\\python.exe',
        'C:\\Python311\\python.exe',
        'C:\\Python310\\python.exe',
        'C:\\Python39\\python.exe'
      ];

      for (const testPath of possiblePaths) {
        if (fs.existsSync(testPath)) {
          pythonPath = testPath;
          break;
        }
      }

      // 如果没找到，尝试使用where命令，但过滤掉WindowsApps
      if (!pythonPath) {
        const { execSync } = require('child_process');
        const wherePython = execSync('where python', { encoding: 'utf8' })
          .split('\n')
          .map((p: string) => p.trim())
          .filter((p: string) => p && !p.includes('WindowsApps'));

        if (wherePython.length > 0) {
          pythonPath = wherePython[0];
        }
      }

      if (!pythonPath) {
        throw new Error('未找到可用的Python安装');
      }

      // 验证Python是否可用
      const { execSync } = require('child_process');
      const versionOutput = execSync(`"${pythonPath}" --version`, { encoding: 'utf8' });
      console.log('找到Python路径:', pythonPath);
      console.log('Python版本:', versionOutput.trim());

    } catch (error) {
      console.error('获取Python路径失败:', error);
      return NextResponse.json(
        { error: '未找到可用的Python安装，请确保Python已正确安装' },
        { status: 500 }
      );
    }

    // 确保python目录存在于PATH中
    const pythonDir = path.dirname(pythonPath);
    const scriptsDir = path.join(pythonDir, 'Scripts');
    const currentPath = process.env.PATH || '';
    const newPath = `${pythonDir};${scriptsDir};${currentPath}`;
    
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
      cwd: path.dirname(scriptPath),
      shell: true
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
      const timeout = setTimeout(() => {
        pythonProcess.kill();
        resolve(NextResponse.json(
          { error: 'Python脚本执行超时' },
          { status: 504 }
        ));
      }, 300000); // 5分钟超时

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        console.log('Python进程退出码:', code);
        
        if (code !== 0) {
          resolve(NextResponse.json(
            { error: `Python脚本执行失败 (${code}): ${error || '未知错误'}` },
            { status: 500 }
          ));
          return;
        }

        try {
          const jsonResult = JSON.parse(result);
          resolve(NextResponse.json(jsonResult));
        } catch (e) {
          resolve(NextResponse.json(
            { error: `无法解析Python输出: ${result}` },
            { status: 500 }
          ));
        }
      });

      pythonProcess.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Python进程错误:', err);
        resolve(NextResponse.json(
          { error: `Python进程启动失败: ${err.message}` },
          { status: 500 }
        ));
      });
    });

  } catch (error: any) {
    console.error('API路由错误:', error);
    return NextResponse.json(
      { error: `处理请求时发生错误: ${error.message}` },
      { status: 500 }
    );
  }
}