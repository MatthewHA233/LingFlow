'use client';

import { useState, useEffect, useRef } from 'react';
import { BookOpen, Headphones, ArrowRight, BookMarked, MessageSquare, ChevronDown, Check, Leaf, Music, Brain } from 'lucide-react';
import { HoverBorderGradient } from '@/components/ui/hover-border-gradient';
import { AuthDialog } from './AuthDialog';
import SplashCursor from '@/components/ui/SplashCursor';
import SplitText from '@/components/ui/SplitText';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GlowingEffect } from '@/components/ui/glowing-effect';

export function UnauthorizedTip() {
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slidesRef = useRef<(HTMLDivElement | null)[]>([]);
  const [showLine1, setShowLine1] = useState(false);
  const [showLine2, setShowLine2] = useState(false);
  const [showLine3, setShowLine3] = useState(false);
  const [showExploreButton, setShowExploreButton] = useState(false);

  // 检测设备性能决定是否显示流体特效
  useEffect(() => {
    const isHighEnd = window.navigator.hardwareConcurrency > 4;
    setShowSplash(isHighEnd);
  }, []);

  // 修复类型错误：更改ref回调函数
  const setSlideRef = (index: number) => (el: HTMLDivElement | null) => {
    slidesRef.current[index] = el;
  };

  // 滚动到下一张幻灯片
  const scrollToSlide = (index: number) => {
    if (slidesRef.current[index]) {
      slidesRef.current[index]?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 监听滚动位置，更新当前幻灯片
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + window.innerHeight / 2;
      
      slidesRef.current.forEach((slide, index) => {
        if (slide) {
          const { offsetTop, offsetHeight } = slide;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setCurrentSlide(index);
          }
        }
      });
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 符合示例的卡片组件
  const GlowCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => {
  return (
      <li className="min-h-[14rem] list-none">
        <div className="relative h-full rounded-2.5xl border p-2 md:rounded-3xl md:p-3">
          <GlowingEffect
            spread={40}
            glow={true}
            disabled={false}
            proximity={64}
            inactiveZone={0.01}
          />
          <div className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-xl border-0.75 p-6 dark:shadow-[0px_0px_27px_0px_#2D2D2D] md:p-6">
            <div className="relative flex flex-1 flex-col justify-between gap-3">
              <div className="w-fit rounded-lg border border-gray-600 p-2">
                {icon}
              </div>
              <div className="space-y-3">
                <h3 className="pt-0.5 text-xl/[1.375rem] font-semibold font-sans -tracking-4 md:text-2xl/[1.875rem] text-balance">
                  {title}
                </h3>
                <h2 className="font-sans text-sm/[1.125rem] md:text-base/[1.375rem] text-muted-foreground">
                  {description}
                </h2>
              </div>
            </div>
          </div>
        </div>
      </li>
    );
  };

  // 添加用户故事卡片组件
  const StoryCard = ({ 
    emoji, 
    title, 
    quote, 
    author 
  }: { 
    emoji: string, 
    title: string, 
    quote: string,
    author: string
  }) => {
    return (
      <li className="min-h-[14rem] list-none">
        <div className="relative h-full rounded-2.5xl border p-2 md:rounded-3xl md:p-3">
          <GlowingEffect
            spread={40}
            glow={true}
            disabled={false}
            proximity={64}
            inactiveZone={0.01}
          />
          <div className="relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-xl border-0.75 p-6 dark:shadow-[0px_0px_27px_0px_#2D2D2D] md:p-6">
            <div className="relative flex flex-1 flex-col justify-between gap-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-xl">{emoji}</span>
              </div>
              <div className="space-y-3">
                <h3 className="pt-0.5 text-xl/[1.375rem] font-semibold font-sans -tracking-4 md:text-2xl/[1.875rem] text-balance">
                  {title}
                </h3>
                <blockquote className="font-sans text-sm/[1.125rem] md:text-base/[1.375rem] text-muted-foreground italic">
                  &quot;{quote}&quot;
                </blockquote>
                <div className="font-medium">{author}</div>
              </div>
            </div>
          </div>
        </div>
      </li>
    );
  };

  const slides = [
    // 幻灯片1：介绍
    <div key="intro" className="h-screen flex flex-col items-center justify-center" ref={setSlideRef(0)}>
      <div className="text-center w-full max-w-3xl mx-auto px-4 sm:px-6">
        <div className="mb-12">
          <SplitText
            text="当语言学习遇见自然生长"
            className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-tighter block"
            delay={80}
            animationFrom={{ opacity: 0, transform: 'translate3d(0,30px,0)' }}
            animationTo={{ opacity: 1, transform: 'translate3d(0,0,0)' }}
            onLetterAnimationComplete={() => setShowLine1(true)}
          />
        </div>
        
        <div className="flex flex-col gap-8 text-base sm:text-lg text-muted-foreground w-full">
          {showLine1 && (
            <div className="w-full flex justify-center">
              <SplitText
                text="就像树木不会通过背诵年轮来生长"
                delay={50}
                animationFrom={{ opacity: 0, transform: 'translate3d(0,20px,0)' }}
                animationTo={{ opacity: 1, transform: 'translate3d(0,0,0)' }}
                onLetterAnimationComplete={() => setShowLine2(true)}
              />
            </div>
          )}
          
          {showLine2 && (
            <div className="w-full flex justify-center">
              <SplitText
                text="我们的大脑也需要在真实的语境土壤中"
                delay={50}
                animationFrom={{ opacity: 0, transform: 'translate3d(0,20px,0)' }}
                animationTo={{ opacity: 1, transform: 'translate3d(0,0,0)' }}
                onLetterAnimationComplete={() => setShowLine3(true)}
              />
            </div>
          )}
          
          {showLine3 && (
            <div className="w-full flex justify-center">
              <SplitText
                text="让词汇的根系自然延伸..."
                delay={50}
                animationFrom={{ opacity: 0, transform: 'translate3d(0,20px,0)' }}
                animationTo={{ opacity: 1, transform: 'translate3d(0,0,0)' }}
                onLetterAnimationComplete={() => setShowExploreButton(true)}
              />
            </div>
          )}
        </div>
        
        {showExploreButton && (
          <motion.div 
            className="mt-16 flex justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <button 
              onClick={() => scrollToSlide(1)}
              className="flex flex-col items-center text-muted-foreground hover:text-primary transition-colors group"
            >
              <span className="mb-2 group-hover:translate-y-1 transition-transform">向下探索</span>
              <ChevronDown className="w-6 h-6 animate-bounce" />
            </button>
          </motion.div>
        )}
      </div>
    </div>,
    
    // 幻灯片2：问题
    <div key="problem" className="min-h-screen flex items-center py-20" ref={setSlideRef(1)}>
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="bg-card/20 backdrop-blur-sm rounded-3xl border border-border p-8 md:p-12"
        >
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">那些年，我们共同的困境</h2>
            <div className="h-0.5 w-20 bg-primary/50 mx-auto my-4"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <GlowCard
                icon={<BookOpen className="w-6 h-6 text-primary" />}
                title="背了就忘"
                description="单词本像沙漏，填得越多，忘得越快。机械记忆无法建立深层联系。"
              />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              viewport={{ once: true }}
            >
              <GlowCard
                icon={<Brain className="w-6 h-6 text-primary" />}
                title="孤立式学习"
                description="单词和语法规则脱离实际语境，就像在真空中学习游泳。"
              />
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              viewport={{ once: true }}
            >
              <GlowCard
                icon={<Music className="w-6 h-6 text-primary" />}
                title="缺乏活用"
                description="需要用词时想不起来，说话写作卡壳，学了很多却用不上。"
              />
            </motion.div>
          </div>
          
          <motion.div 
            className="mt-12 flex justify-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            viewport={{ once: true }}
          >
            <button 
              onClick={() => scrollToSlide(2)}
              className="flex flex-col items-center text-muted-foreground hover:text-primary transition-colors group"
            >
              <span className="mb-2 group-hover:translate-y-1 transition-transform">了解理论基础</span>
              <ChevronDown className="w-6 h-6 animate-bounce" />
            </button>
          </motion.div>
        </motion.div>
      </div>
    </div>,
    
    // 幻灯片3：视频解析
    <div key="video" className="min-h-screen flex items-center py-20" ref={setSlideRef(2)}>
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="bg-card/20 backdrop-blur-sm rounded-3xl border border-border overflow-hidden"
        >
          <div className="p-8 md:p-12">
            <div className="text-center mb-6">
              <h2 className="text-3xl font-bold mb-2">语言习得的本质</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                让我们听听语言学专家罗肖尼的解析，为什么传统词条式学习效果有限？
              </p>
            </div>
          </div>
          
          <div className="aspect-video w-full max-w-4xl mx-auto">
            <iframe 
              src="//player.bilibili.com/player.html?bvid=BV1ns4y1A7fj&spm_id_from=333.337.search-card.all.click" 
              scrolling="no" 
              frameBorder="no" 
              allowFullScreen={true}
              className="w-full h-full"
            ></iframe>
          </div>
          
          <div className="text-center p-6">
            <p className="text-sm text-muted-foreground">
              【罗肖尼】如何永远学会一个单词？ • 哔哩哔哩2023年·金知奖
            </p>
            
            <motion.div 
              className="text-center mt-12 flex justify-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              viewport={{ once: true }}
            >
              <button 
                onClick={() => scrollToSlide(3)}
                className="flex flex-col items-center text-muted-foreground hover:text-primary transition-colors group"
              >
                <span className="mb-2 group-hover:translate-y-1 transition-transform">了解洪流解决方案</span>
                <ChevronDown className="w-6 h-6 animate-bounce" />
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>,
    
    // 幻灯片4：解决方案
    <div key="solution" className="min-h-screen flex items-center py-20" ref={setSlideRef(3)}>
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-3">洪流二语习得，自然成长的陪伴者</h2>
          <div className="h-0.5 w-20 bg-primary/50 mx-auto my-4"></div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            我们打造了一个语言学习生态系统，让每一次阅读都成为习得的机会
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
            className="bg-card/30 backdrop-blur-sm rounded-2xl p-8 border border-border/50 hover:border-primary/30 transition-colors group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-medium mb-3 group-hover:text-primary transition-colors">智能有声书对齐</h3>
                <p className="text-muted-foreground mb-4">将你喜爱的电子书和有声书精确对齐，创造无缝的视听学习体验</p>
                <ul className="space-y-2">
                  <li className="flex items-start text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>听到哪里，文本自动跟随，精确到单词级别</span>
                  </li>
                  <li className="flex items-start text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>一键导入，自动处理，免去手动对齐的繁琐</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            viewport={{ once: true }}
            className="bg-card/30 backdrop-blur-sm rounded-2xl p-8 border border-border/50 hover:border-primary/30 transition-colors group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <BookMarked className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-medium mb-3 group-hover:text-primary transition-colors">语境中的词汇学习</h3>
                <p className="text-muted-foreground mb-4">告别孤立的词汇记忆，在真实语境中理解和记忆单词</p>
                <ul className="space-y-2">
                  <li className="flex items-start text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>大语言模型实时分析词义，展示在词锚点云图中</span>
                  </li>
                  <li className="flex items-start text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>智能识别相似词，帮助你建立词汇辨析网络</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            viewport={{ once: true }}
            className="bg-card/30 backdrop-blur-sm rounded-2xl p-8 border border-border/50 hover:border-primary/30 transition-colors group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Leaf className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-medium mb-3 group-hover:text-primary transition-colors">自然生长的词汇库</h3>
                <p className="text-muted-foreground mb-4">你的个人词汇库会随着阅读量的增加自然生长</p>
                <ul className="space-y-2">
                  <li className="flex items-start text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>词锚点域记录每个词汇在不同语境中的含义</span>
                  </li>
                  <li className="flex items-start text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>建立词汇的深度联系，而不是肤浅的记忆</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            viewport={{ once: true }}
            className="bg-card/30 backdrop-blur-sm rounded-2xl p-8 border border-border/50 hover:border-primary/30 transition-colors group"
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-medium mb-3 group-hover:text-primary transition-colors">活用你的语言知识</h3>
                <p className="text-muted-foreground mb-4">智能复习系统和情境对话，让学到的知识活起来</p>
                <ul className="space-y-2">
                  <li className="flex items-start text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>基于你的学习数据，智能调整复习间隔</span>
                  </li>
                  <li className="flex items-start text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>AI驱动的角色对话，让你在交流中巩固语言</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
        
        <motion.div 
          className="text-center mt-12 flex justify-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          viewport={{ once: true }}
        >
          <button 
            onClick={() => scrollToSlide(4)}
            className="flex flex-col items-center text-muted-foreground hover:text-primary transition-colors group"
          >
            <span className="mb-2 group-hover:translate-y-1 transition-transform">听听用户的故事</span>
            <ChevronDown className="w-6 h-6 animate-bounce" />
          </button>
        </motion.div>
      </div>
    </div>,
    
    // 幻灯片5：用户故事
    <div key="stories" className="min-h-screen flex items-center py-20" ref={setSlideRef(4)}>
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-3">真实的学习者，真实的变化</h2>
          <div className="h-0.5 w-20 bg-primary/50 mx-auto my-4"></div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            他们的故事或许与你相似
          </p>
        </motion.div>
        
        <div className="grid gap-8 md:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <StoryCard
              emoji="📚"
              title="从抗拒到享受阅读"
              quote="现在每天打开喜欢的侦探小说，就像打开一个语言宝箱"
              author="—— 小林，日语学习者"
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <StoryCard
              emoji="🎧"
              title="通勤时间的蜕变"
              quote="地铁上的碎片时间，终于不再是无效的单词背诵"
              author="—— 王先生，商务英语"
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            viewport={{ once: true }}
          >
            <StoryCard
              emoji="🌱"
              title="自然生长的词汇量"
              quote="不知不觉中，那些反复出现的词汇已经深深刻在脑海里"
              author="—— 李同学，法语专业"
            />
          </motion.div>
        </div>
        
        <motion.div 
          className="text-center mt-16 flex justify-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          viewport={{ once: true }}
        >
          <button 
            onClick={() => scrollToSlide(5)}
            className="flex flex-col items-center text-muted-foreground hover:text-primary transition-colors group"
          >
            <span className="mb-2 group-hover:translate-y-1 transition-transform">准备好开始了吗？</span>
            <ChevronDown className="w-6 h-6 animate-bounce" />
          </button>
        </motion.div>
      </div>
    </div>,
    
    // 幻灯片6：注册引导
    <div key="register" className="min-h-screen flex items-center py-20" ref={setSlideRef(5)}>
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center py-16 bg-card/20 backdrop-blur-sm rounded-3xl border border-border/50"
        >
          <div className="mb-8">
            <motion.h3 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-3xl font-bold mb-4"
            >
              让语言学习回归自然
            </motion.h3>
            <motion.p 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              viewport={{ once: true }}
              className="text-muted-foreground px-6"
            >
              我们准备了简单的开始方式，就像播下一颗种子，让它在适宜的环境中生长
            </motion.p>
          </div>
          
          <motion.div 
            className="flex justify-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            viewport={{ once: true }}
          >
            <HoverBorderGradient
              containerClassName="rounded-full"
              className="px-8 py-3 text-lg"
              onClick={() => setShowAuthDialog(true)}
            >
              <span className="flex items-center justify-center gap-2">
                <span>开始培育我的语言花园</span>
                <ArrowRight className="w-5 h-5" />
              </span>
            </HoverBorderGradient>
          </motion.div>
          
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            viewport={{ once: true }}
            className="mt-4 text-sm text-muted-foreground"
          >
            只需几秒钟注册，开启自然习得之旅
          </motion.p>
        </motion.div>
              </div>
              </div>
  ];

  // 改进的滚动指示器，借鉴MultiStepLoader组件样式
  const Indicator = () => {
    const slideNames = ["简介", "问题", "理论", "方案", "故事", "开始"];
    
    return (
      <div className="fixed right-8 top-1/2 transform -translate-y-1/2 z-30 hidden md:flex flex-col items-end gap-3">
        {slideNames.map((name, index) => (
          <motion.button
            key={index}
            className="flex items-center gap-2 group"
            onClick={() => scrollToSlide(index)}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            <span className={cn(
              "text-sm transition-all duration-300 opacity-0 group-hover:opacity-100 group-hover:mr-1",
              currentSlide === index && "opacity-100 mr-1 text-primary"
            )}>
              {name}
            </span>
            <div className="relative">
              {currentSlide === index ? (
                <div className="w-3 h-3 rounded-full bg-primary relative z-10">
                  <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-30"></div>
              </div>
              ) : (
                <div className={cn(
                  "w-2 h-2 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/50 transition-all",
                  "group-hover:scale-125 group-hover:bg-primary/50"
                )}></div>
              )}
            </div>
          </motion.button>
        ))}
          </div>
    );
  };

  return (
    <>
      <div className="relative overflow-x-hidden bg-background">
        {/* 流体背景特效 - 移到最底层 */}
        <div className="fixed inset-0 z-0">
          {showSplash && <SplashCursor />}
        </div>
        
        {/* 所有内容包装在一个相对定位的容器中，确保在流体特效上方 */}
        <div className="relative z-10">
          {/* 幻灯片内容 */}
          {slides}
          
          {/* 滑动指示器 */}
          <Indicator />
        </div>
        
        {/* 底部背景渐变 */}
        <div className="fixed bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-background to-transparent pointer-events-none z-20"></div>
      </div>

      <AuthDialog 
        open={showAuthDialog} 
        onOpenChange={setShowAuthDialog}
        defaultTab="register"
      />
    </>
  );
}