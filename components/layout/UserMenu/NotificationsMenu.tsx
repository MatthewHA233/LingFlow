import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNotificationStore } from '@/stores/notifications';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const PAGE_SIZE = 4;

export function NotificationsMenu() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead,
    fetchNotifications,
    loading
  } = useNotificationStore();

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedNotification, setSelectedNotification] = useState<typeof notifications[0] | null>(null);

  const totalPages = Math.ceil(notifications.length / PAGE_SIZE);
  const paginatedNotifications = notifications.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    fetchNotifications();
    // 每分钟刷新一次通知
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative h-10 w-10 rounded-full p-0 avatar-icon"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[8px] font-medium text-white grid place-items-center leading-none">
                {unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="dropdown-menu-content w-80">
          <div className="flex items-center justify-between px-4 py-2 border-b">
            <span className="text-sm font-medium">消息通知</span>
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs dropdown-menu-item"
                onClick={() => markAllAsRead()}
              >
                全部标为已读
              </Button>
            )}
          </div>
          <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent hover:scrollbar-thumb-gray-400 dark:hover:scrollbar-thumb-gray-600">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                加载中...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                暂无消息
              </div>
            ) : (
              <>
                {paginatedNotifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className="flex flex-col items-start gap-1 p-4 cursor-default hover:bg-transparent notification-item"
                    onClick={() => {
                      markAsRead(notification.id);
                      setSelectedNotification(notification);
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-medium flex items-center gap-2 notification-title">
                        {notification.title}
                        {!notification.read && (
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-xs text-muted-foreground notification-date">
                        {formatDistanceToNow(notification.created_at, { 
                          addSuffix: true,
                          locale: zhCN 
                        })}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
                        notification.type === 'error' ? 'bg-red-100 text-red-700' :
                        notification.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                        notification.type === 'success' ? 'bg-green-100 text-green-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {
                          notification.type === 'error' ? '错误' :
                          notification.type === 'warning' ? '警告' :
                          notification.type === 'success' ? '成功' : '消息'
                        }
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      上一页
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!selectedNotification} onOpenChange={() => setSelectedNotification(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification?.title}
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                selectedNotification?.type === 'error' ? 'bg-red-100 text-red-700' :
                selectedNotification?.type === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                selectedNotification?.type === 'success' ? 'bg-green-100 text-green-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {
                  selectedNotification?.type === 'error' ? '错误' :
                  selectedNotification?.type === 'warning' ? '警告' :
                  selectedNotification?.type === 'success' ? '成功' : '消息'
                }
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {selectedNotification?.message}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedNotification && formatDistanceToNow(selectedNotification.created_at, {
                addSuffix: true,
                locale: zhCN
              })}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 