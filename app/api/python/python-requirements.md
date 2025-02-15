# Python 依赖说明

## 核心依赖
- `aliyun-python-sdk-core==2.15.1`  
  阿里云核心SDK，用于基础API调用

- `oss2==2.18.4`  
  阿里云OSS对象存储SDK，用于音频文件上传

- `python-dotenv==1.0.0`  
  环境变量管理，用于读取.env文件


## 辅助工具
- `requests==2.31.0`  
  HTTP请求库（如有需要）

## 开发依赖
- `pytest==8.1.1`  
  单元测试框架（可选）

## 安装命令
```bash
# 基础安装
pip install aliyun-python-sdk-core==2.15.1 oss2==2.18.4 python-dotenv==1.0.0

# 语音服务扩展
pip install alibabacloud_intelligent-speech>=3.0.8

# 开发工具（可选）
pip install pytest==8.1.1

pip fastapi uvicorn python-dotenv
```

## 版本锁定建议
建议使用虚拟环境并生成requirements.txt：
```bash
pip freeze > requirements.txt
```

## 重要说明
1. 阿里云SDK需配合正确的访问凭证使用
2. 生产环境建议固定版本号
3. 使用前请执行 `source .env` 加载环境变量
```
