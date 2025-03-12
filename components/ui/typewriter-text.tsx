"use client";

import { cn } from "@/lib/utils";
import { motion, stagger, useAnimate, useInView } from "motion/react";
import { useEffect, useState } from "react";

export const SequentialTypewriter = ({
  text,
  className,
  cursorClassName,
  delay = 0, // 延迟开始时间（毫秒）
  startingOpacity = 0,
}: {
  text: string;
  className?: string;
  cursorClassName?: string;
  delay?: number;
  startingOpacity?: number;
}) => {
  const characters = text.split("");
  const [scope, animate] = useAnimate();
  const isInView = useInView(scope);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);

  // 延迟启动
  useEffect(() => {
    if (isInView && !started) {
      const timer = setTimeout(() => {
        setStarted(true);
      }, delay);
      
      return () => clearTimeout(timer);
    }
  }, [isInView, delay, started]);

  useEffect(() => {
    if (isInView && started) {
      animate(
        "span",
        {
          display: "inline-block",
          opacity: 1,
          width: "fit-content",
        },
        {
          duration: 0.2,
          delay: stagger(0.05),
          ease: "easeInOut",
        }
      );
      
      // 计算动画完成时间并设置完成状态
      const animationDuration = 0.2 + (characters.length - 1) * 0.05;
      const timer = setTimeout(() => {
        setCompleted(true);
      }, animationDuration * 1000 - 100); // 增加额外500ms缓冲
      
      return () => clearTimeout(timer);
    }
  }, [isInView, animate, started, characters.length]);

  return (
    <div className={cn("flex items-center", className)}>
      <div className="overflow-hidden text-balance" ref={scope}>
        {characters.map((char, index) => (
          <motion.span
            initial={{ opacity: startingOpacity, display: "none" }}
            key={`char-${index}`}
            className={cn("text-gray-400")}
          >
            {char}
          </motion.span>
        ))}
      </div>
      {started && !completed && (
        <motion.span
          initial={{
            opacity: 0,
          }}
          animate={{
            opacity: 1,
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            repeatType: "reverse",
          }}
          className={cn(
            "block ml-1 rounded-sm w-[4px] h-4 sm:h-6 bg-gray-400 self-end",
            cursorClassName
          )}
        ></motion.span>
      )}
    </div>
  );
}; 