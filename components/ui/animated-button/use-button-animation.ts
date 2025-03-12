'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { createDots } from './dots';

export function useButtonAnimation() {
  const btnAreaRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dotsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!btnAreaRef.current || !btnRef.current || !overlayRef.current) return;

    const btnArea = btnAreaRef.current;
    const btn = btnRef.current;
    const overlay = overlayRef.current;
    let isMouseEnter = false;

    // 检测是否为移动设备
    const isMobile = window.innerWidth <= 768 || 
                    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // 创建粒子
    if (!dotsContainerRef.current) {
      dotsContainerRef.current = createDots({ container: btn });
      
      // 在移动设备上默认显示粒子
      if (isMobile && dotsContainerRef.current) {
        gsap.set(dotsContainerRef.current, { opacity: 0 }); // 先设置为不可见
        gsap.to(dotsContainerRef.current, {
          opacity: 1, 
          duration: 0.5, 
          delay: 4,  // 延迟
          ease: 'power2.inOut'
        });
      }
    }

    // 在移动设备上设置边缘光自动旋转动画
    if (isMobile && overlay) {
      // 设置初始位置，调整到更合适的位置
      gsap.set(overlay, { 
        x: "0%", 
        y: "0%",
        transformOrigin: "center center" 
      });
      
      // 创建旋转动画，将旋转中心点设置得更近一些
      gsap.to(overlay, {
        duration: 8,
        rotation: 360,
        repeat: -1,
        ease: "linear",
        transformOrigin: "50% 150%",  // 调整旋转中心点，使轨迹更小
        delay: 4  // 延迟x秒开始旋转
      });
      
      // 添加轻微的脉动效果增强视觉感受
      gsap.to(overlay, {
        opacity: 0.7,
        scale: 0.9,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        delay: 2  // 延迟2秒开始脉动
      });
    }

    const handleBtnAreaMouseEnter = () => {
      isMouseEnter = true;
    };

    const handleBtnAreaMouseMove = (e: MouseEvent) => {
      if (!isMouseEnter || isMobile) return;
      const rect = btnArea.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      overlay.style.transform = `translate(${x}px, ${y}px)`;
    };

    const handleBtnAreaMouseLeave = () => {
      isMouseEnter = false;
    };

    const handleBtnMouseEnter = () => {
      if (isMobile) return; // 移动设备上不执行hover效果变化
      
      const newShadow = '0px -40px 52.4px -40px rgba(139, 98, 255, 0.5)';
      const newShadowTop = '0px 30px 52.4px -40px rgba(139, 98, 255, 0.2)';
      document.documentElement.style.setProperty('--purple-shadow', newShadow);
      document.documentElement.style.setProperty('--purple-shadow-top', newShadowTop);
      
      if (dotsContainerRef.current) {
        gsap.to(dotsContainerRef.current, {
          opacity: 1,
          duration: 0.5,
          ease: 'power2.inOut'
        });
      }
    };

    const handleBtnMouseLeave = () => {
      if (isMobile) return; // 移动设备上不执行hover效果变化
      
      const originalShadow = '0px -20px 52.4px -40px rgba(139, 98, 255, 0.3)';
      const originalShadowTop = '0px 20px 52.4px -40px rgba(139, 98, 255, 0.1)';
      document.documentElement.style.setProperty('--purple-shadow', originalShadow);
      document.documentElement.style.setProperty('--purple-shadow-top', originalShadowTop);
      
      if (dotsContainerRef.current) {
        gsap.to(dotsContainerRef.current, {
          opacity: 0,
          duration: 0.5,
          ease: 'power2.inOut'
        });
      }
    };

    btnArea.addEventListener('mouseenter', handleBtnAreaMouseEnter);
    btnArea.addEventListener('mousemove', handleBtnAreaMouseMove);
    btnArea.addEventListener('mouseleave', handleBtnAreaMouseLeave);
    btn.addEventListener('mouseenter', handleBtnMouseEnter);
    btn.addEventListener('mouseleave', handleBtnMouseLeave);

    return () => {
      btnArea.removeEventListener('mouseenter', handleBtnAreaMouseEnter);
      btnArea.removeEventListener('mousemove', handleBtnAreaMouseMove);
      btnArea.removeEventListener('mouseleave', handleBtnAreaMouseLeave);
      btn.removeEventListener('mouseenter', handleBtnMouseEnter);
      btn.removeEventListener('mouseleave', handleBtnMouseLeave);
    };
  }, []);

  return { btnAreaRef, btnRef, overlayRef };
}