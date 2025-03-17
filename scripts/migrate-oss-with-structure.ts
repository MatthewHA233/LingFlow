const OSS = require('ali-oss');

async function migrateWithStructure(
  sourceBucket: string, 
  targetBucket: string,
  sourceRegion: string = 'oss-cn-beijing',
  targetRegion: string = 'oss-cn-heyuan',
  accessKeyId: string = process.env.ALIYUN_AK_ID || '',
  accessKeySecret: string = process.env.ALIYUN_AK_SECRET || ''
) {
  // 创建源bucket客户端
  const sourceClient = new OSS({
    region: sourceRegion,
    accessKeyId,
    accessKeySecret,
    bucket: sourceBucket
  });
  
  // 创建目标bucket客户端
  const targetClient = new OSS({
    region: targetRegion,
    accessKeyId,
    accessKeySecret,
    bucket: targetBucket
  });
  
  let marker: string | null = null;
  let count = 0;
  
  do {
    // 列出源bucket中的文件，包括所有目录结构
    const result: any = await sourceClient.list({
      'max-keys': 1000,
      marker: marker || undefined
    }, {});
    
    if (!result.objects || result.objects.length === 0) {
      console.log('没有更多文件');
      break;
    }
    
    // 复制每个文件到目标bucket，保留完整路径
    for (const obj of result.objects) {
      console.log(`复制文件 ${++count}: ${obj.name}`);
      
      try {
        // 获取源文件
        const sourceResult = await sourceClient.get(obj.name);
        
        // 上传到目标bucket，使用相同的路径名
        await targetClient.put(obj.name, sourceResult.content, {
          headers: {
            'Content-Type': obj.type || 'application/octet-stream'
          }
        });
        
        console.log(`成功迁移: ${obj.name}`);
      } catch (error) {
        console.error(`迁移文件 ${obj.name} 失败:`, error);
      }
    }
    
    marker = result.nextMarker;
    console.log(`完成批次，下一标记: ${marker}`);
  } while (marker);
  
  console.log(`总共迁移 ${count} 个文件`);
}

// 使用示例
(async () => {
  try {
    // 加载环境变量
    require('dotenv').config({ path: '.env.local' });
    
    const sourceBucket = 'chango-url'; // 原始bucket名称
    const targetBucket = 'lingflow';    // 目标bucket名称
    const sourceRegion = 'oss-cn-beijing'; // 源bucket区域
    const targetRegion = 'oss-cn-heyuan';  // 目标bucket区域
    
    console.log(`开始从 ${sourceRegion}/${sourceBucket} 迁移到 ${targetRegion}/${targetBucket}...`);
    await migrateWithStructure(sourceBucket, targetBucket, sourceRegion, targetRegion);
    console.log('迁移完成，所有文件结构已保留');
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
  }
})(); 