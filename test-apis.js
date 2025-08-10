// Test script to verify both APIs work
const testResRobotAPI = async () => {
  // Use the correct ResRobot API key format from documentation
  const correctKey = '599505c8-7155-4603-b352-4d31a4d2537b';
  const url = `https://api.resrobot.se/v2.1/trip?format=json&originId=740000773&destId=740000031&accessId=${correctKey}&numF=3&passlist=true`;
  console.log('Testing ResRobot with correct key format...');
  
  try {
    const response = await fetch(url);
    console.log(`ResRobot Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`SUCCESS! ResRobot trips found: ${data.Trip?.length || 0}`);
      if (data.Trip?.[0]) {
        const trip = data.Trip[0];
        console.log(`First trip legs: ${trip.LegList?.Leg?.length || 0}`);
        if (trip.LegList?.Leg?.[0]) {
          const leg = trip.LegList.Leg[0];
          console.log(`First leg: ${leg.Origin?.name} -> ${leg.Destination?.name}`);
          console.log(`Times: ${leg.Origin?.time} - ${leg.Destination?.time}`);
        }
      }
    } else {
      const text = await response.text();
      console.log(`ResRobot Error: ${text.slice(0, 300)}`);
    }
  } catch (error) {
    console.log(`ResRobot Fetch Error: ${error.message}`);
  }
  
  for (let i = 0; i < formats.length; i++) {
    console.log(`\nTesting ResRobot format ${i + 1}:`);
    try {
      const response = await fetch(formats[i]);
      console.log(`Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`SUCCESS! Trips found: ${data.Trip?.length || 0}`);
        if (data.Trip?.[0]) {
          console.log(`First trip keys: ${Object.keys(data.Trip[0])}`);
        }
        return; // Stop on first success
      } else {
        const text = await response.text();
        console.log(`Error: ${text.slice(0, 200)}`);
      }
    } catch (error) {
      console.log(`Fetch Error: ${error.message}`);
    }
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