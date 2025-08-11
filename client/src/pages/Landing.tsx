import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Train, Clock, MapPin, Shield } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            TransitPro
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
            Smart Swedish transit planning with real-time data, modular journey building, 
            and automated compensation claims for delays.
          </p>
          <a href="/api/login">
            <Button size="lg" className="text-lg px-8 py-3">
              Get Started
            </Button>
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-6 w-6 text-blue-600" />
                Smart Planning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Modular journey planning with real Swedish transport data. Add stops, validate connections.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Train className="h-6 w-6 text-green-600" />
                Real-time Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Live departures and delays from ResRobot and Trafiklab APIs. No dummy data.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-6 w-6 text-orange-600" />
                Delay Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Automatic delay detection with proactive notifications and smart routing.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-6 w-6 text-purple-600" />
                Auto Compensation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Automated Swedish transport compensation claims with PDF generation.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Powered by authentic Swedish transport APIs
          </p>
          <a href="/api/login">
            <Button variant="outline" size="lg">
              Sign In to Continue
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}