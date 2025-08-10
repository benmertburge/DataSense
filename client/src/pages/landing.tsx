import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Train, Bell, FileText, Shield, Clock, MapPin } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Train className="text-blue-600 text-xl mr-3" />
              <h1 className="text-xl font-bold text-blue-600">TransitPro</h1>
            </div>
            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Sign In
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Smart Transit Management
            <span className="block text-blue-600">Made Simple</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Plan your journeys, get real-time delay alerts, and automatically claim compensation 
            when things go wrong. Your intelligent transit companion.
          </p>
          <Button 
            size="lg" 
            onClick={() => window.location.href = '/api/login'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg"
          >
            Get Started Free
          </Button>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <Card className="border-none shadow-lg">
            <CardHeader>
              <MapPin className="w-10 h-10 text-blue-600 mb-2" />
              <CardTitle>Smart Journey Planning</CardTitle>
              <CardDescription>
                Plan multi-leg journeys with real-time updates and alternative route suggestions
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <Bell className="w-10 h-10 text-amber-600 mb-2" />
              <CardTitle>Proactive Delay Alerts</CardTitle>
              <CardDescription>
                Get notified before delays impact your journey with smart timing notifications
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <FileText className="w-10 h-10 text-green-600 mb-2" />
              <CardTitle>Automatic Compensation</CardTitle>
              <CardDescription>
                Detect eligible delays and generate compensation claims with secure data handling
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <Clock className="w-10 h-10 text-purple-600 mb-2" />
              <CardTitle>Real-time Monitoring</CardTitle>
              <CardDescription>
                Track your journeys in real-time with live delay calculations and updates
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <Shield className="w-10 h-10 text-red-600 mb-2" />
              <CardTitle>Secure Data Protection</CardTitle>
              <CardDescription>
                Bank-grade encryption for personal information with GDPR compliance
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-none shadow-lg">
            <CardHeader>
              <Train className="w-10 h-10 text-indigo-600 mb-2" />
              <CardTitle>Multi-Modal Support</CardTitle>
              <CardDescription>
                Works with buses, trains, metros, and ferries across the entire SL network
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="text-center bg-white rounded-2xl shadow-xl p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Never Miss a Connection Again
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Join thousands of commuters who trust TransitPro for their daily journeys
          </p>
          <Button 
            size="lg" 
            onClick={() => window.location.href = '/api/login'}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg"
          >
            Start Your Free Trial
          </Button>
        </div>
      </div>
    </div>
  );
}
