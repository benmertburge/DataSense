import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Info, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ServiceAlerts() {
  const { data: deviations, isLoading } = useQuery({
    queryKey: ['/api/deviations'],
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoading) {
    return (
      <Card className="shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-600 rounded"></div>
            <div className="h-16 bg-gray-200 dark:bg-gray-600 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="text-error-red" />;
      case 'warn':
        return <AlertTriangle className="text-warning-amber" />;
      case 'info':
      default:
        return <Info className="text-transit-blue" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warn':
        return <Badge className="bg-warning-amber text-white">Warning</Badge>;
      case 'info':
      default:
        return <Badge variant="outline">Information</Badge>;
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('sv-SE', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('sv-SE', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getTimeDescription = (validFrom?: string, validTo?: string, lastUpdated?: string) => {
    const parts = [];
    
    if (validTo) {
      const validToDate = new Date(validTo);
      const now = new Date();
      
      if (validToDate > now) {
        parts.push(`Active until ${formatTime(validTo)}`);
      }
    }
    
    if (lastUpdated) {
      const lastUpdatedDate = new Date(lastUpdated);
      const now = new Date();
      const diffMinutes = Math.round((now.getTime() - lastUpdatedDate.getTime()) / 60000);
      
      if (diffMinutes < 60) {
        parts.push(`Updated ${diffMinutes} min ago`);
      } else {
        parts.push(`Updated ${Math.round(diffMinutes / 60)}h ago`);
      }
    }
    
    return parts.join(' • ');
  };

  return (
    <Card className="shadow-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <CardHeader className="border-b border-gray-200 dark:border-gray-700">
        <CardTitle className="flex items-center text-gray-900 dark:text-white">
          <AlertTriangle className="text-warning-amber mr-2" />
          Service Alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {deviations && deviations.length > 0 ? (
          <div className="space-y-4">
            {deviations.map((alert: any) => (
              <div 
                key={alert.id}
                className={`flex space-x-3 p-4 rounded-lg border ${
                  alert.severity === 'critical' 
                    ? 'bg-red-50 border-red-200' 
                    : alert.severity === 'warn'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex-shrink-0 mt-1">
                  {getSeverityIcon(alert.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-sm">{alert.title}</h4>
                    {getSeverityBadge(alert.severity)}
                  </div>
                  <p className="text-sm text-gray-700 mb-2">{alert.message}</p>
                  
                  {/* Affected areas/lines */}
                  {(alert.affectedAreaIds?.length > 0 || alert.affectedLineIds?.length > 0) && (
                    <div className="mb-2">
                      <div className="flex flex-wrap gap-1">
                        {alert.affectedLineIds?.map((lineId: string) => (
                          <Badge key={lineId} variant="secondary" className="text-xs">
                            Line {lineId}
                          </Badge>
                        ))}
                        {alert.affectedAreaIds?.slice(0, 3).map((areaId: string) => (
                          <Badge key={areaId} variant="outline" className="text-xs">
                            {areaId}
                          </Badge>
                        ))}
                        {alert.affectedAreaIds?.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{alert.affectedAreaIds.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center text-xs text-gray-600">
                    <Clock className="h-3 w-3 mr-1" />
                    {getTimeDescription(alert.validFrom, alert.validTo, alert.lastUpdated)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium mb-2">No Active Service Alerts</h3>
            <p className="text-sm">All services are running normally</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
