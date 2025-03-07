#!/bin/bash

# 输出调试信息
echo "脚本开始执行..."
pwd
whoami

# 设置错误时退出
set -e

# 进入项目目录
cd /var/www/html/LingFlow/app/api/python
echo "当前目录: $(pwd)"

# 确保虚拟环境存在
if [ ! -d "venv" ]; then
    echo "错误: 虚拟环境不存在"
    exit 1
fi

# 激活虚拟环境
source venv/bin/activate
echo "Python 版本: $(python --version)"
echo "Python 路径: $(which python)"

# 进入项目目录
cd /var/www/html/LingFlow
echo "项目目录: $(pwd)"

# 删除旧的构建文件
echo "清理旧的构建文件和缓存..."
rm -rf .next
npm cache clean --force

# 验证缓存是否已清除
npm cache verify

# 重新构建前端
echo "开始重新构建前端..."
npm run build

# 确保激活成功
if [ -z "$VIRTUAL_ENV" ]; then
    echo "错误: 虚拟环境激活失败"
    exit 1
fi

# 启动应用
echo "启动应用..."
npm start