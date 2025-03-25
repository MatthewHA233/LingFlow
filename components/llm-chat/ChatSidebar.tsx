"use client";
import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext, useEffect } from "react";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { Bot, Trash2, Plus, History, X, ChevronRight, Search, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";

interface LLMModel {
  id: string;
  provider: string;
  name: string;
  displayName: string;
  description: string;
  iconSrc: string;
  maxTokens: number;
  temperature: number;
}

interface ChatSettings {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  defaultModelId: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  isLoading?: boolean;
  reasoningContent?: string;
}

interface SearchResult {
  conversationId: string;
  messageId: string;
  content: string;
  matchText: string;
  index: number;
}

interface ChatSidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  getModelIcon: (modelName: string) => string;
  getModelDisplayName: (modelName: string) => string;
  scrollToMessage: (messageId: string, matchIndex: number) => void;
  availableModels: Array<any>;
  settings: ChatSettings;
  selectedModel: LLMModel;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export function ChatSidebar({
  conversations,
  currentConversationId,
  onSelect,
  onDelete,
  onNew,
  open,
  setOpen,
  getModelIcon = () => '/icons/bot-default.svg',
  getModelDisplayName = () => 'AI',
  scrollToMessage,
  availableModels,
  settings,
  selectedModel
}: ChatSidebarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  
  // 执行高级搜索并存储结果
  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }
    
    const results: SearchResult[] = [];
    
    conversations.forEach(conversation => {
      conversation.messages.forEach(message => {
        if (message.role === 'user' || message.role === 'assistant') {
          // 搜索消息内容
          const content = message.content.toLowerCase();
          const term = searchTerm.toLowerCase();
          
          if (content.includes(term)) {
            // 找到所有匹配项
            let startIndex = 0;
            let index;
            
            while ((index = content.indexOf(term, startIndex)) !== -1) {
              // 提取匹配文本的上下文（前后50个字符）
              const contextStart = Math.max(0, index - 50);
              const contextEnd = Math.min(content.length, index + term.length + 50);
              let matchText = content.substring(contextStart, contextEnd);
              
              // 如果截取了部分文本，添加省略号
              if (contextStart > 0) matchText = '...' + matchText;
              if (contextEnd < content.length) matchText = matchText + '...';
              
              results.push({
                conversationId: conversation.id,
                messageId: message.id,
                content: message.content,
                matchText,
                index
              });
              
              startIndex = index + term.length;
            }
          }
        }
      });
    });
    
    setSearchResults(results);
  }, [searchTerm, conversations]);
  
  // 添加关闭侧边栏的处理函数
  const closeSidebar = () => {
    setOpen(false);
  };
  
  // 增强的搜索过滤功能，可以搜索对话内容和标题
  const filteredConversations = searchTerm 
    ? conversations.filter(conv => {
        // 搜索标题
        if (conv.title.toLowerCase().includes(searchTerm.toLowerCase())) {
          return true;
        }
        
        // 搜索消息内容（仅用户消息）
        const userMessages = conv.messages.filter(msg => msg.role === 'user');
        return userMessages.some(msg => 
          msg.content.toLowerCase().includes(searchTerm.toLowerCase())
        );
      })
    : conversations;
  
  // 获取对话中最后使用的模型名称
  const getLastModelUsed = (conversation: Conversation): string | null => {
    // 反向遍历消息找到最后一条助手消息
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      const msg = conversation.messages[i];
      if (msg.role === 'assistant' && msg.model) {
        return msg.model;
      }
    }
    return null;
  };
  
  // 正确创建状态更新函数包装器
  const setOpenStateAction: React.Dispatch<React.SetStateAction<boolean>> = 
    (value) => setOpen(typeof value === 'function' ? value(open) : value);
  
  return (
    <SidebarContext.Provider value={{ open, setOpen: setOpenStateAction }}>
      <>
        {/* 桌面版侧边栏 */}
        <DesktopSidebar 
          conversations={filteredConversations}
          currentConversationId={currentConversationId}
          onSelect={onSelect}
          onDelete={onDelete}
          onNew={onNew}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          closeSidebar={closeSidebar}
          getModelIcon={getModelIcon}
          getModelDisplayName={getModelDisplayName}
          getLastModelUsed={getLastModelUsed}
          searchResults={searchResults}
          scrollToMessage={scrollToMessage}
          availableModels={availableModels}
          settings={settings}
          selectedModel={selectedModel}
        />
        
        {/* 移动版侧边栏 */}
        <MobileSidebar 
          conversations={filteredConversations}
          currentConversationId={currentConversationId}
          onSelect={(id) => {
            onSelect(id);
            closeSidebar();
          }}
          onDelete={onDelete}
          onNew={() => {
            onNew();
            closeSidebar();
          }}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          closeSidebar={closeSidebar}
          getModelIcon={getModelIcon}
          getModelDisplayName={getModelDisplayName}
          getLastModelUsed={getLastModelUsed}
          searchResults={searchResults}
          scrollToMessage={scrollToMessage}
          availableModels={availableModels}
          settings={settings}
          selectedModel={selectedModel}
        />
      </>
    </SidebarContext.Provider>
  );
}

// 桌面版侧边栏
function DesktopSidebar({
  conversations,
  currentConversationId,
  onSelect,
  onDelete,
  onNew,
  searchTerm,
  setSearchTerm,
  closeSidebar,
  getModelIcon,
  getModelDisplayName,
  getLastModelUsed,
  searchResults,
  scrollToMessage,
  availableModels,
  settings,
  selectedModel,
}: Omit<ChatSidebarProps, 'open' | 'setOpen'> & {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  closeSidebar: () => void;
  getModelIcon: (modelName: string) => string;
  getModelDisplayName: (modelName: string) => string;
  getLastModelUsed: (conversation: Conversation) => string | null;
  searchResults: SearchResult[];
  scrollToMessage: (messageId: string, matchIndex: number) => void;
  availableModels: Array<any>;
  settings: ChatSettings;
  selectedModel: LLMModel;
}) {
  const { open } = useSidebar();
  
  return (
    <Motion.div
      className={cn(
        "h-full hidden md:flex md:flex-col bg-gradient-to-b from-[#070c19] to-[#0d172e] border-r border-white/10 shadow-2xl z-30",
        open ? "w-[260px]" : "w-0" 
      )}
      initial={{ width: 0 }}
      animate={{ width: open ? 260 : 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {open && (
        <div className="flex flex-col h-full">
          <div className="p-3 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-medium text-white flex items-center">
                <History className="h-4 w-4 mr-2 text-blue-400" />
                对话历史
              </h3>
            </div>
            
            <div className="flex justify-center">
              <HoverBorderGradient
                containerClassName="w-[180px] rounded-full"
                className="w-full"
              >
                <Button
                  className="w-full h-6 flex items-center justify-center gap-2.5 bg-transparent hover:bg-white/5 text-white text-base px-1 group"
                  onClick={onNew}
                >
                  <div className="transition-transform duration-500 group-hover:rotate-[360deg]">
                    <Image 
                      src={getModelIcon(availableModels.find(m => m.id === settings.defaultModelId)?.name || selectedModel.name)}
                      alt="AI"
                      width={18}
                      height={18}
                      className="rounded-full"
                    />
                  </div>
                  新建对话
                </Button>
              </HoverBorderGradient>
            </div>
            
            <div className="relative mt-3">
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索对话..."
                className="bg-[#111520] border-white/10 focus:border-blue-500/50 text-gray-300 pl-8 text-sm h-9"
              />
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.1) transparent'
          }}>
            {(() => {
              if (searchTerm && searchResults.length > 0) {
                return (
                  <div className="mb-2 px-2">
                    <h3 className="text-xs font-medium text-gray-400 mb-1.5">搜索结果 ({searchResults.length})</h3>
                    <div className="space-y-1.5">
                      {searchResults.map((result, idx) => (
                        <div 
                          key={`${result.conversationId}-${result.messageId}-${idx}`}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer text-xs"
                          onClick={() => {
                            onSelect(result.conversationId);
                            setTimeout(() => scrollToMessage(result.messageId, result.index), 100);
                            closeSidebar();
                          }}
                        >
                          <div className="text-blue-400 mb-1 truncate">
                            {conversations.find(c => c.id === result.conversationId)?.title || "对话"}
                          </div>
                          <div className="text-gray-300">
                            {highlightSearchTerm(result.matchText, searchTerm)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              } else if (searchTerm) {
                return (
                  <div className="text-center py-6">
                    <div className="text-sm text-gray-400">没有找到相关对话</div>
                  </div>
                );
              } else if (conversations.length === 0) {
                return (
                  <div className="text-center py-6">
                    <div className="w-14 h-14 rounded-full bg-blue-900/20 flex items-center justify-center mx-auto mb-3">
                      <Bot className="h-7 w-7 text-blue-400 opacity-70" />
                    </div>
                    <div className="text-sm text-gray-400">
                      没有历史对话
                    </div>
                    <Button
                      className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                      onClick={() => {
                        onNew();
                        closeSidebar();
                      }}
                    >
                      开始新对话
                    </Button>
                  </div>
                );
              } else {
                return (
                  <div className="space-y-2">
                    {conversations.map((conversation) => (
                      <Motion.div
                        key={conversation.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`p-2.5 rounded-lg cursor-pointer transition-all duration-200 group relative hover:shadow-md ${
                          conversation.id === currentConversationId 
                            ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 shadow-lg shadow-blue-500/5' 
                            : 'hover:bg-white/5 border border-transparent'
                        }`}
                        onClick={() => onSelect(conversation.id)}
                      >
                        <div className="flex items-center">
                          <div className="w-7 h-7 flex items-center justify-center mr-2">
                            {(() => {
                              const lastModel = getLastModelUsed(conversation);
                              if (lastModel && getModelIcon) {
                                return (
                                  <Image 
                                    src={getModelIcon(lastModel)}
                                    alt="模型"
                                    width={24}
                                    height={24}
                                    className="rounded-full"
                                  />
                                );
                              }
                              return <Bot className="h-5 w-5 text-blue-400" />;
                            })()}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-300 truncate text-sm flex items-center">
                              {conversation.title === '正在生成摘要...' ? (
                                <>
                                  <span className="mr-1 text-blue-400">{conversation.title}</span>
                                  <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                                </>
                              ) : (
                                conversation.title || "新对话"
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 flex items-center">
                              <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500 mr-1"></div>
                              {new Date(conversation.updatedAt).toLocaleString('zh-CN', {
                                month: 'numeric',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </div>
                          </div>
                          
                          {/* 删除对话按钮 */}
                          <button
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(conversation.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </Motion.div>
                    ))}
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}
    </Motion.div>
  );
}

// 移动版侧边栏
function MobileSidebar({
  conversations,
  currentConversationId,
  onSelect,
  onDelete,
  onNew,
  searchTerm,
  setSearchTerm,
  closeSidebar,
  getModelIcon,
  getModelDisplayName,
  getLastModelUsed,
  searchResults,
  scrollToMessage,
  availableModels,
  settings,
  selectedModel,
}: Omit<ChatSidebarProps, 'open' | 'setOpen'> & {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  closeSidebar: () => void;
  getModelIcon: (modelName: string) => string;
  getModelDisplayName: (modelName: string) => string;
  getLastModelUsed: (conversation: Conversation) => string | null;
  searchResults: SearchResult[];
  scrollToMessage: (messageId: string, matchIndex: number) => void;
  availableModels: Array<any>;
  settings: ChatSettings;
  selectedModel: LLMModel;
}) {
  const { open, setOpen } = useSidebar();
  
  return (
    <AnimatePresence>
      {open && (
        <Motion.div
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="fixed inset-0 z-50 md:hidden"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          
          <Motion.div 
            className="absolute left-0 top-0 h-full w-[280px] bg-[#0a0e14]/95 backdrop-blur-md border-r border-white/10 flex flex-col"
          >
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-base font-medium text-white flex items-center">
                <History className="h-4 w-4 mr-2 text-blue-400" />
                对话历史
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-3">
              <div className="flex justify-center">
                <HoverBorderGradient
                  containerClassName="w-[160px] rounded-full"
                  className="w-full"
                >
                  <Button
                    className="w-full h-6 flex items-center justify-center gap-2.5 bg-transparent hover:bg-white/5 text-white text-base px-1 group"
                    onClick={() => {
                      onNew();
                      setOpen(false);
                    }}
                  >
                    <div className="transition-transform duration-500 group-hover:rotate-[360deg]">
                      <Image 
                        src={getModelIcon(availableModels.find(m => m.id === settings.defaultModelId)?.name || selectedModel.name)}
                        alt="AI"
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                    </div>
                    新建对话
                  </Button>
                </HoverBorderGradient>
              </div>
              
              <div className="relative mt-3">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索对话..."
                  className="bg-[#111520] border-white/10 focus:border-blue-500/50 text-gray-300 pl-7 text-xs h-7"
                />
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-500" />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto" style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.1) transparent'
            }}>
              {(() => {
                if (searchTerm && searchResults.length > 0) {
                  return (
                    <div className="mb-2 px-2">
                      <h3 className="text-xs font-medium text-gray-400 mb-1.5">搜索结果 ({searchResults.length})</h3>
                      <div className="space-y-1.5">
                        {searchResults.map((result, idx) => (
                          <div 
                            key={`${result.conversationId}-${result.messageId}-${idx}`}
                            className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer text-xs"
                            onClick={() => {
                              onSelect(result.conversationId);
                              setTimeout(() => scrollToMessage(result.messageId, result.index), 100);
                              closeSidebar();
                            }}
                          >
                            <div className="text-blue-400 mb-1 truncate">
                              {conversations.find(c => c.id === result.conversationId)?.title || "对话"}
                            </div>
                            <div className="text-gray-300">
                              {highlightSearchTerm(result.matchText, searchTerm)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } else if (searchTerm) {
                  return (
                    <div className="text-center py-6">
                      <div className="text-sm text-gray-400">没有找到相关对话</div>
                    </div>
                  );
                } else if (conversations.length === 0) {
                  return (
                    <div className="text-center py-6">
                      <div className="w-14 h-14 rounded-full bg-blue-900/20 flex items-center justify-center mx-auto mb-3">
                        <Bot className="h-7 w-7 text-blue-400 opacity-70" />
                      </div>
                      <div className="text-sm text-gray-400">
                        没有历史对话
                      </div>
                      <Button
                        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                        onClick={() => {
                          onNew();
                          closeSidebar();
                        }}
                      >
                        开始新对话
                      </Button>
                    </div>
                  );
                } else {
                  return (
                    <div className="space-y-1.5">
                      {conversations.map((conversation) => (
                        <div
                          key={conversation.id}
                          className={`p-2 rounded-lg cursor-pointer transition-colors group relative ${
                            conversation.id === currentConversationId 
                              ? 'bg-blue-600/20 border border-blue-500/30' 
                              : 'hover:bg-white/5 border border-transparent'
                          }`}
                          onClick={() => {
                            onSelect(conversation.id);
                            setOpen(false);
                          }}
                        >
                          <div className="flex items-center">
                            <div className="w-7 h-7 flex items-center justify-center mr-2">
                              {(() => {
                                const lastModel = getLastModelUsed(conversation);
                                if (lastModel && getModelIcon) {
                                  return (
                                    <Image 
                                      src={getModelIcon(lastModel)}
                                      alt="模型"
                                      width={24}
                                      height={24}
                                      className="rounded-full"
                                    />
                                  );
                                }
                                return <Bot className="h-5 w-5 text-blue-400" />;
                              })()}
                            </div>
                            <div className="flex-1 truncate text-xs text-gray-300">
                              {conversation.title === '正在生成摘要...' ? (
                                <>
                                  <span className="mr-1 text-blue-400">{conversation.title}</span>
                                  <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                                </>
                              ) : (
                                conversation.title || "新对话"
                              )}
                            </div>
                            
                            {/* 删除对话按钮 */}
                            <button
                              className="text-gray-500 hover:text-red-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(conversation.id);
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          
                          <div className="text-[10px] text-gray-500 mt-0.5 truncate pl-7">
                            {new Date(conversation.updatedAt).toLocaleString('zh-CN', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
              })()}
            </div>
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
  );
}

// 高亮显示搜索词的辅助函数
const highlightSearchTerm = (text: string, term: string) => {
  if (!term) return text;
  
  const parts = text.split(new RegExp(`(${term})`, 'gi'));
  return (
    <>
      {parts.map((part, index) => 
        part.toLowerCase() === term.toLowerCase() 
          ? <span key={index} className="bg-yellow-500/30 text-white font-medium">{part}</span> 
          : part
      )}
    </>
  );
}; 