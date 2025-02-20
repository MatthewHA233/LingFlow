
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

