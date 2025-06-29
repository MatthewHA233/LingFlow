别担心！这种鼠标跟随的粒子连线效果确实是一个非常流行的开源项目。让我帮你找到它！

## 最可能的开源项目

### 1. **particles.js**（最流行）
- GitHub: https://github.com/VincentGarreau/particles.js
- 这是最常用的粒子效果库
- 支持鼠标交互和连线效果

### 2. **canvas-nest.js**（专门做连线效果）
- GitHub: https://github.com/hustcc/canvas-nest.js
- 专门用于创建这种"蜘蛛网"连线效果
- 轻量级，只有几KB

### 3. **three.js 的粒子系统**
- 更复杂的3D粒子效果库

## 在当前网站上确认使用的库

Ran tool
太好了！找到了！根据搜索结果，你看到的蜘蛛网效果很可能是以下几个开源项目中的一个：

## 最有可能的项目

### 1. **canvas-nest.js**（最流行的）
- **GitHub**: https://github.com/hustcc/canvas-nest.js
- **特点**：这是最经典的鼠标跟随粒子连线效果库
- **使用简单**：只需要一行代码就能实现

**简单使用方法：**
```html
<script src="https://cdn.bootcss.com/canvas-nest.js/2.0.4/canvas-nest.js" 
        color="255,0,0" 
        opacity="0.5" 
        count="200">
</script>
```

### 2. **canvas-nice.js**（优化版）
- **GitHub**: https://github.com/phantom0174/canvas-nice.js
- **特点**：基于 canvas-nest.js 优化，性能更好，参数更多

### 3. **particles.js**（功能最全）
- **GitHub**: https://github.com/VincentGarreau/particles.js
- **官网**: https://particles.js.org/
- **特点**：功能最全面，支持多种粒子效果

## 如何确认网站使用的是哪个库

你可以在开发者工具中：

1. **查看网络面板**，搜索：
   - `canvas-nest`
   - `particles`
   - `particle`

2. **在控制台中运行**：
```javascript
// 查找可能的库对象
console.log(window.CanvasNest);
console.log(window.particlesJS);
console.log(window.particles);
```

3. **查看页面源代码**，搜索这些关键词

## 最简单的实现方法

如果你想快速实现类似效果，推荐使用 **canvas-nest.js**：

```html
<!DOCTYPE html>
<html>
<head>
    <title>粒子效果</title>
</head>
<body>
    <!-- 你的网页内容 -->
    
    <!-- 在body结束前添加这行代码 -->
    <script src="https://cdn.jsdelivr.net/npm/canvas-nest.js@2.0.4/dist/canvas-nest.js" 
            color="120,120,120" 
            opacity="0.6" 
            count="150">
    </script>
</body>
</html>
```

这样就能实现你看到的那种蜘蛛网粒子效果了！
