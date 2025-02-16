const fs = require('fs');
const path = require('path');

const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'ALIYUN_AK_ID',
    'ALIYUN_AK_SECRET'
  ];
  
  // 读取 .env.local 文件
  const envPath = path.resolve(process.cwd(), '.env.local');
  let envContent = {};
  
  try {
    const fileContent = fs.readFileSync(envPath, 'utf8');
    envContent = fileContent.split('\n').reduce((acc, line) => {
      const [key, value] = line.split('=');
      if (key && value) {
        acc[key.trim()] = value.trim();
      }
      return acc;
    }, {});
  } catch (error) {
    console.warn('⚠️ 无法读取 .env.local 文件，将仅检查 process.env');
  }
  
  // 合并环境变量
  const allEnvVars = {
    ...envContent,
    ...process.env
  };
  
  // 检查必需的环境变量
  let missingVars = false;
  requiredEnvVars.forEach(env => {
    if (!allEnvVars[env]) {
      console.error(`❌ 缺失必要环境变量: ${env}`);
      missingVars = true;
    }
  });
  
  if (missingVars) {
    process.exit(1);
  } else {
    console.log('✅ 所有环境变量检查通过');
  }