import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Train, Clock, MapPin, Route } from 'lucide-react';
import { Link } from 'wouter';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            TransitPro
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Smart journey planning with real-time Swedish transit data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Route className="h-5 w-5 text-blue-600" />
                Journey Planner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Plan complex journeys with modular legs, add intermediate stops, and validate each connection.
              </p>
              <Link href="/planner">
                <Button className="w-full">
                  Plan Journey
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Train className="h-5 w-5 text-green-600" />
                My Commutes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Save frequent routes and get real-time departure notifications.
              </p>
              <Link href="/commute">
                <Button variant="outline" className="w-full">
                  Manage Commutes
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-600" />
                Compensation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Track delays and automatically claim compensation for Swedish transport.
              </p>
              <Link href="/compensation">
                <Button variant="outline" className="w-full">
                  View Claims
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Using real Swedish transport data from ResRobot and Trafiklab APIs
          </p>
        </div>
      </div>
    </div>
  );
}