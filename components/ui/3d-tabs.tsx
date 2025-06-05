"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Tab = {
  title: string;
  value: string;
  content?: string | React.ReactNode | any;
};

export const Tabs = ({
  tabs: propTabs,
  containerClassName,
  activeTabClassName,
  tabClassName,
  contentClassName,
  disable3D = false,
  activeTab,
  onTabChange,
}: {
  tabs: Tab[];
  containerClassName?: string;
  activeTabClassName?: string;
  tabClassName?: string;
  contentClassName?: string;
  disable3D?: boolean;
  activeTab?: string;
  onTabChange?: (tabValue: string) => void;
}) => {
  // 初始化内部状态
  const getInitialActiveTab = () => {
    if (activeTab) {
      return propTabs.find(tab => tab.value === activeTab) || propTabs[0];
    }
    return propTabs[0];
  };

  const getInitialTabsOrder = () => {
    if (activeTab && !disable3D) {
      const targetIndex = propTabs.findIndex(tab => tab.value === activeTab);
      if (targetIndex > 0) {
        const newTabs = [...propTabs];
        const selectedTab = newTabs.splice(targetIndex, 1);
        newTabs.unshift(selectedTab[0]);
        return newTabs;
      }
    }
    return propTabs;
  };

  const [internalActive, setInternalActive] = useState<Tab>(getInitialActiveTab);
  const [tabs, setTabs] = useState<Tab[]>(getInitialTabsOrder);

  // 计算当前活跃的tab
  const active = activeTab 
    ? propTabs.find(tab => tab.value === activeTab) || propTabs[0]
    : internalActive;

  // 当外部activeTab变化时，同步内部状态（避免初始化时的重复处理）
  useEffect(() => {
    if (activeTab) {
      console.log('3D-tabs收到activeTab变化:', activeTab); // 调试信息
      const targetTab = propTabs.find(tab => tab.value === activeTab);
      if (targetTab && targetTab.value !== internalActive.value) {
        console.log('需要切换到:', targetTab.title); // 调试信息
        if (!disable3D) {
          // 3D模式：调整tabs顺序，将目标tab移到最前面
          const targetIndex = propTabs.findIndex(tab => tab.value === activeTab);
          if (targetIndex >= 0 && tabs[0].value !== activeTab) {
            const newTabs = [...propTabs];
            const selectedTab = newTabs.splice(targetIndex, 1);
            newTabs.unshift(selectedTab[0]);
            setTabs(newTabs);
            console.log('3D模式：调整tabs顺序完成'); // 调试信息
          }
        }
        // 更新内部状态
        setInternalActive(targetTab);
        console.log('更新内部状态完成'); // 调试信息
      }
    }
  }, [activeTab, disable3D, propTabs, internalActive.value, tabs]);

  const moveSelectedTabToTop = (idx: number) => {
    const newTabs = [...propTabs];
    const selectedTab = newTabs.splice(idx, 1);
    newTabs.unshift(selectedTab[0]);
    setTabs(newTabs);
    
    if (activeTab !== undefined && onTabChange) {
      // 外部控制模式
      onTabChange(selectedTab[0].value);
    } else {
      // 内部状态模式
      setInternalActive(newTabs[0]);
    }
  };

  const handleTabClick = (tab: Tab, idx: number) => {
    if (disable3D) {
      if (activeTab !== undefined && onTabChange) {
        // 外部控制模式
        onTabChange(tab.value);
      } else {
        // 内部状态模式
        setInternalActive(tab);
      }
    } else {
      moveSelectedTabToTop(idx);
    }
  };

  const [hovering, setHovering] = useState(false);

  return (
    <>
      <div
        className={cn(
          "flex flex-row items-center justify-start [perspective:1000px] relative overflow-auto sm:overflow-visible no-visible-scrollbar max-w-full w-full",
          containerClassName
        )}
      >
        {propTabs.map((tab, idx) => (
          <button
            key={tab.title}
            onClick={() => handleTabClick(tab, idx)}
            onMouseEnter={() => !disable3D && setHovering(true)}
            onMouseLeave={() => !disable3D && setHovering(false)}
            className={cn("relative px-4 py-2 rounded-full", tabClassName)}
            style={{
              transformStyle: disable3D ? "flat" : "preserve-3d",
            }}
          >
            {active.value === tab.value && (
              <motion.div
                layoutId="clickedbutton"
                transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                className={cn(
                  "absolute inset-0 bg-gray-200 dark:bg-zinc-800 rounded-full ",
                  activeTabClassName
                )}
              />
            )}

            <span className="relative block text-black dark:text-white">
              {tab.title}
            </span>
          </button>
        ))}
      </div>
      
      {/* 3D动画层，仅用于视觉效果 */}
      {disable3D ? (
        <div className={contentClassName || "mt-2"}>
          {propTabs.find(tab => tab.value === active.value)?.content}
        </div>
      ) : (
        <FadeInDiv
          tabs={tabs}
          active={active}
          key={active.value}
          hovering={hovering}
          propTabs={propTabs}
          className={contentClassName || "mt-8"}
        />
      )}
    </>
  );
};

export const FadeInDiv = ({
  className,
  tabs,
  hovering,
  propTabs,
}: {
  className?: string;
  key?: string;
  tabs: Tab[];
  active: Tab;
  hovering?: boolean;
  propTabs?: Tab[];
}) => {
  const isActive = (tab: Tab) => {
    return tab.value === tabs[0].value;
  };
  
  // 使用propTabs来渲染所有内容，避免重复渲染
  const allTabs = propTabs || tabs;
  
  return (
    <div className="relative w-full h-full">
      {allTabs.map((tab, idx) => {
        const tabIndex = tabs.findIndex(t => t.value === tab.value);
        const isCurrentActive = isActive(tab);
        const displayIndex = tabIndex >= 0 ? tabIndex : idx;
        
        return (
          <motion.div
            key={tab.value}
            layoutId={tab.value}
            style={{
              scale: tabIndex >= 0 ? 1 - displayIndex * 0.1 : 0,
              top: hovering && tabIndex >= 0 ? displayIndex * -50 : 0,
              zIndex: tabIndex >= 0 ? -displayIndex : -999,
              opacity: tabIndex >= 0 && displayIndex < 3 ? 1 - displayIndex * 0.1 : 0,
              visibility: tabIndex >= 0 ? 'visible' : 'hidden',
            }}
            animate={{
              y: isCurrentActive ? [0, 40, 0] : 0,
            }}
            className={cn("w-full h-full absolute top-0 left-0", className)}
          >
            {tab.content}
          </motion.div>
        );
      })}
    </div>
  );
}; 