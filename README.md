# forward-slash-game

横版自动推进动作肉鸽游戏原型。本阶段是 **Phaser 3 + Vite + 原生 JavaScript** 实现的“第一阶段：自动前进原型”。

## 功能

- 1280×720 横屏设计分辨率，并通过 Phaser Scale FIT 自适应桌面和手机屏幕。
- 全部角色、背景、云、地面均使用 Phaser Graphics 绘制，无需外部图片素材。
- 蓝色玩家角色站在地面上并持续自动向右奔跑。
- 摄像机跟随玩家，背景和地面向右延伸。
- 顶部显示阶段标题。
- 右下角提供可触摸/可鼠标点击的圆形“攻击”按钮；点击仅显示短暂提示，不造成伤害。
- 页面禁止滚动、双击缩放和触摸手势缩放，适合横屏全屏游玩。

## 本地运行

```bash
npm install
npm run dev
```

开发服务器启动后，按终端提示打开本地地址。

## 构建

```bash
npm run build
```

构建产物输出到 `dist/`，可用于静态托管。

## 预览构建产物

```bash
npm run preview
```

## GitHub Pages 自动部署

仓库包含 `.github/workflows/deploy-pages.yml`。当代码推送到 `main` 分支时，GitHub Actions 会：

1. 安装依赖；
2. 执行 `npm run build`；
3. 上传 `dist/`；
4. 部署到 GitHub Pages。

首次使用时，需要在 GitHub 仓库设置中启用 Pages，并将 Source 设置为 **GitHub Actions**。
