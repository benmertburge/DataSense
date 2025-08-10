// Test script to verify both APIs work
const testResRobotAPI = async () => {
  // Test different ResRobot endpoint formats from the documentation
  const formats = [
    `https://api.resrobot.se/v2.1/trip?originId=740000773&destId=740000031&format=json&accessId=${process.env.RESROBOT_API_KEY}`,
    `https://api.resrobot.se/v2.1/trip.json?originId=740000773&destId=740000031&accessId=${process.env.RESROBOT_API_KEY}`,
    `https://api.resrobot.se/v2.1/trip?originExtId=740000773&destExtId=740000031&format=json&accessId=${process.env.RESROBOT_API_KEY}`
  ];
  
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