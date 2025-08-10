// Test script to verify both APIs work
const testResRobotAPI = async () => {
  const url = `https://api.resrobot.se/v2.1/trip?originId=740000773&destId=740000031&format=json&accessId=${process.env.RESROBOT_API_KEY}&numTrips=1&time=08:30&date=2025-08-11`;
  
  try {
    const response = await fetch(url);
    console.log(`ResRobot API Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`ResRobot trips found: ${data.Trip?.length || 0}`);
      if (data.Trip?.[0]?.LegList?.Leg?.[0]) {
        const leg = data.Trip[0].LegList.Leg[0];
        console.log(`First leg time: ${leg.Origin?.time} - ${leg.Destination?.time}`);
      }
    } else {
      const text = await response.text();
      console.log(`ResRobot Error: ${text}`);
    }
  } catch (error) {
    console.log(`ResRobot Fetch Error: ${error.message}`);
  }
};

const testTrafiklabAPI = async () => {
  // Use correct Trafiklab API format with area ID and time
  const timeParam = "2025-08-11T08:30";
  const url = `https://realtime-api.trafiklab.se/v1/departures/740000773/${timeParam}?key=${process.env.TRAFIKLAB_API_KEY}`;
  
  try {
    const response = await fetch(url);
    console.log(`Trafiklab API Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`Trafiklab response keys: ${Object.keys(data)}`);
      if (data.departures) {
        console.log(`Trafiklab departures found: ${data.departures.length}`);
        if (data.departures[0]) {
          const dep = data.departures[0];
          console.log(`First departure keys: ${Object.keys(dep)}`);
          console.log(`Sample departure:`, JSON.stringify(dep, null, 2));
        }
      }
    } else {
      const text = await response.text();
      console.log(`Trafiklab Error: ${text}`);
    }
  } catch (error) {
    console.log(`Trafiklab Fetch Error: ${error.message}`);
  }
};

// Run tests
console.log("Testing APIs...");
testResRobotAPI();
testTrafiklabAPI();