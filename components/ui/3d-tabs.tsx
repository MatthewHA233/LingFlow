"use client";

import { useState } from "react";
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
}: {
  tabs: Tab[];
  containerClassName?: string;
  activeTabClassName?: string;
  tabClassName?: string;
  contentClassName?: string;
  disable3D?: boolean;
}) => {
  const [active, setActive] = useState<Tab>(propTabs[0]);
  const [tabs, setTabs] = useState<Tab[]>(propTabs);

  const moveSelectedTabToTop = (idx: number) => {
    const newTabs = [...propTabs];
    const selectedTab = newTabs.splice(idx, 1);
    newTabs.unshift(selectedTab[0]);
    setTabs(newTabs);
    setActive(newTabs[0]);
  };

  const handleTabClick = (tab: Tab, idx: number) => {
    if (disable3D) {
      setActive(tab);
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