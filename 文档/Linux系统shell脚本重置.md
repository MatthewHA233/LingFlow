`````bash
root@iZf8zc5pvfykw0pjvmi0siZ:/var/www/html/LingFlow# bash -x /var/www/html/LingFlow/start-python-env.sh
+ $'\r'
/var/www/html/LingFlow/start-python-env.sh: line 2: $'\r': command not found
+ set $'-e\r'
: invalid optionngFlow/start-python-env.sh: line 4: set: -
set: usage: set [-abefhkmnptuvxBCHP] [-o option-name] [--] [arg ...]
+ $'\r'
/var/www/html/LingFlow/start-python-env.sh: line 5: $'\r': command not found
+ cd $'/var/www/html/LingFlow/app/api/python\r'
/var/www/html/LingFlow/start-python-env.sh: line 7: cd: $'/var/www/html/LingFlow/app/api/python\r': No such file or directory
+ $'\r'
/var/www/html/LingFlow/start-python-env.sh: line 8: $'\r': command not found
/var/www/html/LingFlow/start-python-env.sh: line 42: syntax error: unexpected end of file
`````

看来文件仍然包含Windows格式的换行符。让我们用更直接的方式来修复这个问题：

1. 首先，在服务器上直接创建新文件：

`````bash
# 删除旧文件
rm /var/www/html/LingFlow/start-python-env.sh

# 使用 cat 创建新文件
cat > /var/www/html/LingFlow/start-python-env.sh << 'EOF'
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
EOF

# 设置执行权限
chmod +x /var/www/html/LingFlow/start-python-env.sh
`````

2. 验证文件格式：

`````bash
# 检查文件格式
file /var/www/html/LingFlow/start-python-env.sh

# 测试脚本
bash -x /var/www/html/LingFlow/start-python-env.sh
`````

3. 如果脚本没问题，重启 PM2：

`````bash
pm2 delete all
pm2 start ecosystem.config.js
pm2 logs
`````

这样直接在 Linux 系统上创建文件，可以确保文件使用正确的换行符格式。如果还有问题，请告诉我错误信息。
