import OSS from 'ali-oss';

// 检测是否在阿里云内网环境
async function isInAliyunIntranet(): Promise<boolean> {
  console.log('🔍 检测是否在阿里云内网环境...');
  const startTime = Date.now();
  try {
    // 尝试访问阿里云内网元数据服务
    const response = await fetch('http://100.100.100.200/latest/meta-data/', {
      signal: AbortSignal.timeout(1000)  // 1秒超时
    });
    const isIntranet = response.ok;
    const detectTime = Date.now() - startTime;
    console.log(`✅ 内网环境检测完成: ${isIntranet ? '【内网】' : '【公网】'} (耗时: ${detectTime}ms)`);
    return isIntranet;
  } catch (error) {
    const detectTime = Date.now() - startTime;
    console.log(`❌ 内网环境检测失败: 【公网】 (耗时: ${detectTime}ms, 错误: ${error instanceof Error ? error.message : String(error)})`);
    return false;
  }
}

// 检测是否在允许的环境中
async function isAllowedEnvironment(): Promise<boolean> {
  try {
    // 如果是开发环境
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    // 如果是生产环境，检查是否在阿里云服务器上
    const response = await fetch('http://100.100.100.200/latest/meta-data/', {
      signal: AbortSignal.timeout(1000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

// URL转换函数：将OSS默认URL转换为自定义域名URL
export function transformUrl(ossUrl: string): string {
  const customDomain = process.env.OSS_CUSTOM_DOMAIN;
  
  if (!customDomain) {
    // 如果没有自定义域名，确保返回公网可访问的URL（去除-internal）
    return ossUrl.replace(/-internal\.aliyuncs\.com/, '.aliyuncs.com');
  }
  
  // 解析OSS URL，提取文件路径
  try {
    const url = new URL(ossUrl);
    const pathname = url.pathname; // 例如: /books/user123/book456/file.epub
    
    // 确保自定义域名以https://开头且不以/结尾
    const cleanCustomDomain = customDomain.replace(/\/$/, '');
    const finalCustomDomain = cleanCustomDomain.startsWith('http') 
      ? cleanCustomDomain 
      : `https://${cleanCustomDomain}`;
    
    const finalUrl = `${finalCustomDomain}${pathname}`;
    
    console.log(`🔄 URL转换: ${ossUrl} -> ${finalUrl}`);
    return finalUrl;
  } catch (error) {
    console.warn(`⚠️ URL转换失败，使用原始URL: ${ossUrl}`, error);
    return ossUrl.replace(/-internal\.aliyuncs\.com/, '.aliyuncs.com');
  }
}

// 创建 OSS 客户端的工厂函数
export async function createOSSClient() {
  console.log('🚀 开始创建OSS客户端...');
  const startTime = Date.now();
  
  // 使用环境变量，如果不存在则使用默认值
  const region = process.env.OSS_REGION || 'oss-cn-beijing';
  const bucket = process.env.OSS_BUCKET || 'chango-url';
  const accessKeyId = process.env.ALIYUN_AK_ID;
  const accessKeySecret = process.env.ALIYUN_AK_SECRET;
  const customDomain = process.env.OSS_CUSTOM_DOMAIN; // 自定义域名，例如: https://static.lingflow.cn
  
  if (!accessKeyId || !accessKeySecret) {
    console.error('❌ 缺少OSS认证配置参数');
    throw new Error('Missing OSS authentication configuration');
  }

  // 检查是否在阿里云内网环境
  const isIntranet = await isInAliyunIntranet();
  
  // 根据环境选择适当的endpoint
  const endpoint = isIntranet 
    ? `${region}-internal.aliyuncs.com`  // 内网endpoint
    : `${region}.aliyuncs.com`;          // 公网endpoint
  
  console.log(`📡 OSS连接信息:
    - 连接模式: ${isIntranet ? '【阿里云内网】' : '【公网】'}
    - Endpoint: ${endpoint}
    - Bucket: ${bucket}
    - Region: ${region}
    - 自定义域名: ${customDomain || '未配置'}
  `);

  const config = {
    endpoint,  // 使用动态确定的endpoint
    accessKeyId,
    accessKeySecret,
    bucket,
    secure: true,
    timeout: 60000
  };

  try {
    console.log('🔄 初始化OSS客户端...');
    const client = new OSS(config);
    
    console.log('🔄 测试Bucket访问权限...');
    const bucketTestStart = Date.now();
    await client.getBucketInfo(config.bucket!);
    const bucketTestTime = Date.now() - bucketTestStart;
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ OSS客户端创建成功! (bucket测试: ${bucketTestTime}ms, 总耗时: ${totalTime}ms)`);
    
    return client;
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ OSS客户端创建失败 (耗时: ${totalTime}ms):`, {
      code: error.code,
      message: error.message,
      requestId: error.requestId
    });
    throw error;
  }
}

export async function uploadToOSS(data: Buffer, name: string): Promise<{url: string, name: string}> {
  console.log(`📤 开始上传文件: ${name} (${data.length} 字节)`);
  const startTime = Date.now();
  
  try {
    const client = await createOSSClient();
    
    // 尝试上传
    console.log(`🔄 正在上传数据...`);
    const uploadStart = Date.now();
    const result = await client.put(name, data, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });
    const uploadTime = Date.now() - uploadStart;

    // 使用transformUrl函数转换URL
    const finalUrl = transformUrl(result.url);

    const totalTime = Date.now() - startTime;
    console.log(`✅ 上传成功! (上传耗时: ${uploadTime}ms, 总耗时: ${totalTime}ms)`, {
      originalUrl: result.url,
      finalUrl: finalUrl,
      name: name,
      size: data.length,
      status: result.res.status
    });

    return {
      url: finalUrl, // 返回转换后的URL
      name
    };
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ 上传失败 (耗时: ${totalTime}ms):`, {
      name,
      size: data.length,
      error: error.message,
      code: error.code,
      requestId: error.requestId,
      status: error.status,
      host: error.host
    });
    throw error;
  }
}

// 添加获取签名 URL 的函数
export async function getSignedUrl(objectName: string): Promise<string> {
  const client = await createOSSClient();
  
  const signedUrl = await client.signatureUrl(objectName, {
    expires: 3600,
    process: 'style/default'
  });
  
  // 使用transformUrl函数转换URL
  return transformUrl(signedUrl);
}

// 导出删除目录函数
export async function deleteOSSDirectory(prefix: string) {
  const client = await createOSSClient();
  let marker: string | null = null;
  
  try {
    do {
      const result = await client.list({
        prefix,
        'max-keys': 1000,
        marker: marker || undefined
      }, {});
      
      if (result.objects && result.objects.length > 0) {
        await client.deleteMulti(
          result.objects.map(obj => obj.name),
          { quiet: true }
        );
      }
      
      marker = result.nextMarker;
    } while (marker);
  } catch (error) {
    console.error(`删除目录 ${prefix} 失败:`, error);
    throw error;
  }
}