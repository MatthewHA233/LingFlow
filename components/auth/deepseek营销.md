// ... 保持导入和状态部分不变

return (
  <>
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-background">
      {showSplash && <SplashCursor />}
      
      <div className="container relative z-10 mx-auto px-4 py-12 max-w-7xl">
        {/* 开篇故事 */}
        <div className="text-center mb-24">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tighter mb-6">
            当语言学习遇见<span className="text-primary">自然生长</span>
          </h1>
          <div className="max-w-3xl mx-auto space-y-4 text-lg text-muted-foreground">
            <p>就像树木不会通过背诵年轮来生长</p>
            <p>我们的大脑，也需要在真实的语境土壤中</p>
            <p>让词汇的根系自然延伸...</p>
          </div>
        </div>

        {/* 学习旅程展示 */}
        <div className="mb-32 space-y-24">
          {/* 问题发现 */}
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <div className="bg-primary/10 p-4 rounded-2xl inline-block mb-6">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">那些年我们共同经历的困境</h3>
              <div className="space-y-3 text-muted-foreground">
                <p>▸ 背了又忘的单词本，像永远填不满的沙漏</p>
                <p>▸ 语法书上的规则，遇到真实语境就失效</p>
                <p>▸ 学过的词汇，在需要时总想不起来</p>
              </div>
            </div>
            <div className="flex-1 aspect-video bg-muted/50 rounded-2xl overflow-hidden">
              <img 
                src="/assets/learning-struggle.jpg" 
                alt="学习困境" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* 解决方案 */}
          <div className="flex flex-col md:flex-row-reverse items-center gap-12">
            <div className="flex-1">
              <div className="bg-primary/10 p-4 rounded-2xl inline-block mb-6">
                <Headphones className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">找到属于你的语言生态</h3>
              <div className="space-y-3 text-muted-foreground">
                <p>▸ 让每本你爱的书都变成会说话的老师</p>
                <p>▸ 在重复出现的语境中自然记住词汇</p>
                <p>▸ 像母语者一样通过使用来巩固知识</p>
              </div>
            </div>
            <div className="flex-1 aspect-video bg-muted/50 rounded-2xl overflow-hidden">
              <img 
                src="/assets/language-ecosystem.jpg" 
                alt="语言生态" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* 用户成长故事 */}
        <div className="mb-32">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">真实的学习者，真实的变化</h2>
            <p className="text-muted-foreground">他们的故事或许与你相似</p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3">
            <div className="bg-card/40 p-8 rounded-2xl border border-border">
              <div className="mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-xl">📚</span>
                </div>
                <h4 className="text-lg font-medium">从抗拒到享受阅读</h4>
              </div>
              <blockquote className="text-muted-foreground italic">
                "现在每天打开喜欢的侦探小说，就像打开一个语言宝箱"
              </blockquote>
              <div className="mt-4 font-medium">—— 小林，日語学习者</div>
            </div>

            <div className="bg-card/40 p-8 rounded-2xl border border-border">
              <div className="mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-xl">🎧</span>
                </div>
                <h4 className="text-lg font-medium">通勤时间的蜕变</h4>
              </div>
              <blockquote className="text-muted-foreground italic">
                "地铁上的碎片时间，终于不再是无效的单词背诵"
              </blockquote>
              <div className="mt-4 font-medium">—— 王先生，商务英语</div>
            </div>

            <div className="bg-card/40 p-8 rounded-2xl border border-border">
              <div className="mb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <span className="text-xl">🌱</span>
                </div>
                <h4 className="text-lg font-medium">自然生长的词汇量</h4>
              </div>
              <blockquote className="text-muted-foreground italic">
                "不知不觉中，那些反复出现的词汇已经深深刻在脑海里"
              </blockquote>
              <div className="mt-4 font-medium">—— 李同学，法语专业</div>
            </div>
          </div>
        </div>

        {/* 自然引导注册 */}
        <div className="text-center py-16">
          <div className="max-w-2xl mx-auto mb-8">
            <h3 className="text-2xl font-semibold mb-4">让语言学习回归自然</h3>
            <p className="text-muted-foreground">
              我们准备了简单的开始方式，就像播下一颗种子
            </p>
          </div>
          <button 
            onClick={() => setShowAuthDialog(true)}
            className="px-8 py-3 bg-transparent border border-primary/30 rounded-full hover:bg-primary/5 transition-colors text-primary"
          >
            开始培育我的语言花园 →
          </button>
        </div>
      </div>
    </div>

    <AuthDialog 
      open={showAuthDialog} 
      onOpenChange={setShowAuthDialog}
      defaultTab="register"
    />
  </>
);