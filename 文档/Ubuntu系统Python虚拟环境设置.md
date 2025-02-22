
# Python 虚拟环境设置 (Ubuntu)

本指南介绍如何在 Ubuntu 系统中为 Python 项目创建和管理虚拟环境。

## 步骤

### 1. 创建虚拟环境

首先，进入你的项目的 Python 代码目录。通常，这可能是一个名为 `app/api/python` 的子目录：

```bash
cd app/api/python
```

然后，使用 Python 的 `venv` 模块创建虚拟环境。我们将虚拟环境命名为 `venv`：

```bash
python3 -m venv venv
```

### 2. 激活虚拟环境

创建完成后，你需要激活虚拟环境。这将使你的 shell 使用虚拟环境中的 Python 解释器和包，而不是全局安装的 Python。

```bash
source venv/bin/activate
```

激活后，你的命令行提示符应该会发生变化，显示虚拟环境的名称（例如 `(venv)`）。

### 3. 安装依赖

激活虚拟环境后，你可以使用 `pip` 安装项目所需的依赖。通常，项目的依赖会列在一个名为 `requirements.txt` 的文件中。使用以下命令安装这些依赖：

```bash
pip install -r requirements.txt
```
如果你的requirements.txt在python文件夹下，则：
````
pip install -r app/api/python/requirements.txt
````

如果你的 `requirements.txt` 文件内容如下：

```
aliyun-python-sdk-core>=2.13.3
python-dotenv>=0.19.0
requests>=2.26.0
```

`pip` 将会自动安装这些包及其依赖项。

### 4. 运行项目 (示例)

安装完依赖后，你可以返回项目根目录并启动你的应用程序（例如，Next.js 开发服务器）：

```bash
cd ../../../  # 返回项目根目录
npm run dev
```

## 重要提示

*   **Python 版本:** 确保 `python3` 命令指向你希望用于项目的 Python 版本。
*   **依赖管理:** 始终在虚拟环境中安装项目依赖，以避免冲突。
*   **`.gitignore`:** 将虚拟环境目录（例如 `venv`）添加到 `.gitignore` 文件，以防止将其提交到 Git 仓库。
* **退出虚拟环境**
在命令行输入
````
deactivate
````
即可

## PM2自动化管理

### 1. 创建启动脚本

创建一个名为 `start-python-env.sh` 的脚本文件：

```bash
#!/bin/bash

# 设置错误时退出
set -e

# 构建前端
npm run build

# 进入项目目录
cd /app/api/python || exit 1

# 确保虚拟环境存在
if [ ! -d "venv" ]; then
    echo "错误: 虚拟环境不存在"
    exit 1
fi

# 激活虚拟环境
source venv/bin/activate

# 确保激活成功
if [ -z "$VIRTUAL_ENV" ]; then
    echo "错误: 虚拟环境激活失败"
    exit 1
fi

# 保持脚本运行
exec "$@"
```

### 2. 配置PM2

使用PM2配置文件管理Python应用。创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: "python-app",
    script: "./start-python-env.sh",
    interpreter: "bash",
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: "production",
    }
  }]
}
```

### 3. 启动服务

```bash
pm2 start ecosystem.config.js
```

设置PM2开机自启：
```bash
pm2 startup
pm2 save
```

// ... existing code ...
```

这样设置后，每次系统重启，PM2都会自动启动你的Python虚拟环境和应用。记住要将脚本中的路径替换为你实际的项目路径。