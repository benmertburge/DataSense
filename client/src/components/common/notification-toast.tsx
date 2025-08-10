import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { X, AlertTriangle, CheckCircle, Info, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NotificationData {
  id: string;
  type: 'delay' | 'compensation' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'default' | 'outline';
  }>;
}

export default function NotificationToast() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    if (!lastMessage) return;

    let notification: NotificationData | null = null;

    switch (lastMessage.type) {
      case 'journey_update':
        if (lastMessage.journey?.delayMinutes > 0) {
          notification = {
            id: `delay-${Date.now()}`,
            type: 'delay',
            title: 'Delay Alert',
            message: `Your journey is now delayed by ${lastMessage.journey.delayMinutes} minutes. Alternative routes may be available.`,
            timestamp: new Date(),
            actions: [
              {
                label: 'View Alternatives',
                action: () => {
                  // Navigate to alternatives or update UI
                  console.log('View alternatives clicked');
                },
              },
            ],
          };
        }
        break;

      case 'compensation_eligible':
        notification = {
          id: `compensation-${Date.now()}`,
          type: 'compensation',
          title: 'Compensation Available',
          message: 'You may be eligible for compensation due to this delay. Would you like to file a claim?',
          timestamp: new Date(),
          actions: [
            {
              label: 'File Claim',
              action: () => {
                // Open compensation modal
                console.log('File claim clicked');
              },
            },
          ],
        };
        break;

      case 'compensation_detected':
        notification = {
          id: `auto-compensation-${Date.now()}`,
          type: 'success',
          title: 'Compensation Case Created',
          message: `We've automatically detected a delay that qualifies for compensation (${lastMessage.cases?.[0]?.delayMinutes} minutes).`,
          timestamp: new Date(),
          actions: [
            {
              label: 'View Case',
              action: () => {
                // Navigate to compensation page
                window.location.href = '/compensation';
              },
            },
          ],
        };
        break;

      default:
        break;
    }

    if (notification) {
      setNotifications(prev => [...prev, notification!]);
      
      // Auto-dismiss after 10 seconds if no actions
      if (!notification.actions || notification.actions.length === 0) {
        setTimeout(() => {
          dismissNotification(notification!.id);
        }, 10000);
      }
    }
  }, [lastMessage]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'delay':
        return <AlertTriangle className="text-warning-amber" />;
      case 'compensation':
        return <Clock className="text-transit-blue" />;
      case 'success':
        return <CheckCircle className="text-success-green" />;
      case 'info':
      default:
        return <Info className="text-transit-blue" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case 'delay':
        return 'border-warning-amber';
      case 'compensation':
        return 'border-transit-blue';
      case 'success':
        return 'border-success-green';
      case 'info':
      default:
        return 'border-gray-200';
    }
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('sv-SE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 space-y-3 z-50 max-w-sm">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`bg-white border rounded-lg shadow-lg p-4 ${getBorderColor(notification.type)} animate-in slide-in-from-right duration-300`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              {getIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm">{notification.title}</h4>
                  <p className="text-sm text-gray-700 mt-1">{notification.message}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {formatTime(notification.timestamp)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1 h-auto"
                  onClick={() => dismissNotification(notification.id)}
                >
                  <X className="h-4 w-4 text-gray-400" />
                </Button>
              </div>
              
              {notification.actions && notification.actions.length > 0 && (
                <div className="mt-3 flex space-x-2">
                  {notification.actions.map((action, index) => (
                    <Button
                      key={index}
                      variant={action.variant || 'default'}
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        action.action();
                        dismissNotification(notification.id);
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-gray-500"
                    onClick={() => dismissNotification(notification.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
