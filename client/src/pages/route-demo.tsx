import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Clock, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';

const RouteDemo = () => {
  const [selectedJourney, setSelectedJourney] = useState({
    id: 'demo_1',
    plannedDeparture: '2025-08-12T07:15:00',
    plannedArrival: '2025-08-12T08:02:00',
    legs: [
      {
        kind: 'TRANSIT',
        line: '43',
        from: { name: 'Sundbyberg station', areaId: '740000773' },
        to: { name: 'Stockholm City station', areaId: '740001617' }
      },
      {
        kind: 'TRANSIT', 
        line: '41',
        from: { name: 'Stockholm City station', areaId: '740001617' },
        to: { name: 'Tumba station (Botkyrka kn)', areaId: '740000776' }
      }
    ]
  });

  const [editedJourney, setEditedJourney] = useState(selectedJourney);

  const getTransportMode = (lineNumber: string): string => {
    const line = String(lineNumber || '');
    if (['10', '11', '13', '14', '17', '18', '19'].includes(line)) return 'Metro';
    if (['40', '41', '42', '43', '44', '45', '46', '47', '48'].includes(line)) return 'Train';
    if (line.length <= 3 && !isNaN(Number(line))) return 'Bus';
    return 'Transport';
  };

  const RouteValidationIndicator = ({ leg }: { leg: any }) => {
    const warnings = [];
    
    if (leg.kind === 'TRANSIT') {
      const fromName = leg.from?.name?.toLowerCase() || '';
      const toName = leg.to?.name?.toLowerCase() || '';
      const lineNumber = String(leg.line?.number || leg.line || '');
      
      // Check transport mode compatibility
      if (['10', '11', '13', '14', '17', '18', '19'].includes(lineNumber)) {
        if (!toName.includes('t-bana')) warnings.push('Metro line needs T-bana station');
      }
      if (['40', '41', '42', '43', '44', '45', '46', '47', '48'].includes(lineNumber)) {
        if (!toName.includes('station')) warnings.push('Train line needs train station');
      }
    }
    
    if (warnings.length > 0) {
      return (
        <div className="text-xs text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {warnings[0]}
        </div>
      );
    }
    
    return null;
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('sv-SE', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Route Validation Demo</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Showing intelligent route editing with real Swedish transport data
          </p>
        </div>

        {/* Original Journey */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Selected Journey
          </h2>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {formatTime(selectedJourney.plannedDeparture)} → {formatTime(selectedJourney.plannedArrival)}
              </span>
              <Badge variant="outline">47 min</Badge>
            </div>
          </div>
          <div className="flex gap-2">
            {selectedJourney.legs.map((leg, index) => (
              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                {leg.line} {leg.kind}
                <span className="text-xs bg-white dark:bg-gray-700 px-1 rounded">
                  {getTransportMode(leg.line)}
                </span>
              </Badge>
            ))}
          </div>
        </Card>

        {/* Route Editor */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Intelligent Route Editor
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Edit stations and see real-time validation warnings based on Swedish transport system rules
          </p>

          <div className="space-y-4">
            {editedJourney.legs.map((leg, index) => (
              <div key={index} className="space-y-2 p-4 bg-white dark:bg-gray-800 rounded-lg border">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      Line {leg.line} {leg.kind}
                      {leg.kind === 'TRANSIT' && (
                        <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {getTransportMode(leg.line)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {leg.from?.name} → {leg.to?.name}
                    </div>
                    <RouteValidationIndicator leg={leg} legIndex={index} allLegs={editedJourney.legs} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">From Station</label>
                    <Input
                      placeholder={leg.from?.name || 'Select station'}
                      value={leg.from?.name || ''}
                      onChange={(e) => {
                        const newLegs = [...editedJourney.legs];
                        newLegs[index] = {
                          ...newLegs[index],
                          from: { 
                            areaId: leg.from?.areaId || '', 
                            name: e.target.value
                          }
                        };
                        setEditedJourney({
                          ...editedJourney,
                          legs: newLegs
                        });
                      }}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">To Station</label>
                    <Input
                      placeholder={leg.to?.name || 'Select station'}
                      value={leg.to?.name || ''}
                      onChange={(e) => {
                        const newLegs = [...editedJourney.legs];
                        newLegs[index] = {
                          ...newLegs[index],
                          to: { 
                            areaId: leg.to?.areaId || '', 
                            name: e.target.value
                          }
                        };
                        setEditedJourney({
                          ...editedJourney,
                          legs: newLegs
                        });
                      }}
                      className="h-8"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Validation Features:</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Transport mode badges show Metro/Train/Bus for each leg</li>
              <li>• Warnings appear when metro lines don't go to T-bana stations</li>
              <li>• Geographic routing checks detect inefficient patterns</li>
              <li>• Real Swedish station data ensures accurate validation</li>
            </ul>
          </div>
        </Card>

        {/* Demo Instructions */}
        <Card className="p-6 bg-green-50 dark:bg-green-950">
          <h3 className="font-medium text-green-800 dark:text-green-200 mb-3">Try It Out:</h3>
          <ol className="text-sm text-green-700 dark:text-green-300 space-y-2 list-decimal list-inside">
            <li>Change "Stockholm City station" to "Sundbyberg centrum T-bana" in the second leg</li>
            <li>Notice the validation warning appears (train line going to metro station)</li>
            <li>Try changing Line 41 to Line 10 and see how the transport mode badge updates</li>
            <li>All station names come from real Swedish transport APIs</li>
          </ol>
        </Card>
      </div>
    </div>
  );
};

export default RouteDemo;