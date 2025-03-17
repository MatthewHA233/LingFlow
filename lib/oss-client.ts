import OSS from 'ali-oss';

// 检测是否在阿里云内网环境
async function isInAliyunIntranet(): Promise<boolean> {
  try {
    // 尝试访问阿里云内网元数据服务
    const response = await fetch('http://100.100.100.200/latest/meta-data/', {
      signal: AbortSignal.timeout(1000)  // 1秒超时
    });
    return response.ok;
  } catch {
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

// 创建 OSS 客户端的工厂函数
export async function createOSSClient() {
  if (!process.env.ALIYUN_AK_ID || !process.env.ALIYUN_AK_SECRET || 
      !process.env.OSS_REGION || !process.env.OSS_BUCKET) {
    throw new Error('Missing OSS configuration');
  }

  const config = {
    region: process.env.OSS_REGION,
    accessKeyId: process.env.ALIYUN_AK_ID,
    accessKeySecret: process.env.ALIYUN_AK_SECRET,
    bucket: process.env.OSS_BUCKET,
    secure: true,
    timeout: 60000
  };

  try {
    const client = new OSS(config);
    await client.getBucketInfo(config.bucket!);
    return client;
  } catch (error: any) {
    console.error('Failed to create client:', {
      code: error.code,
      message: error.message,
      requestId: error.requestId
    });
    throw error;
  }
}

export async function uploadToOSS(data: Buffer, name: string): Promise<{url: string, name: string}> {
  try {
    const client = await createOSSClient();
    
    // 先测试 bucket 权限
    try {
      await client.getBucketInfo(process.env.OSS_BUCKET!);
      console.log('Bucket access test passed');
    } catch (error) {
      console.error('Bucket access test failed:', error);
    }

    // 尝试上传
    console.log(`Uploading ${name} (${data.length} bytes)`);
    const result = await client.put(name, data, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });

    console.log('Upload result:', {
      url: result.url,
      status: result.res.status,
      headers: result.res.headers
    });

    return {
      url: result.url,
      name
    };
  } catch (error: any) {
    console.error('Upload error details:', {
      name,
      error: error.message,
      code: error.code,
      requestId: error.requestId,
      status: error.status,
      host: error.host,
      headers: error.headers
    });
    throw error;
  }
}

// 添加获取签名 URL 的函数
export async function getSignedUrl(objectName: string): Promise<string> {
  const client = await createOSSClient();
  
  return await client.signatureUrl(objectName, {
    expires: 3600,
    process: 'style/default'
  });
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