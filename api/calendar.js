export default async function handler(req, res) {
  try {
    const timestamp = Date.now();
    const calendar_url = `https://calendar.google.com/calendar/ical/hb1392%40gmail.com/private-0dfa0fc5e9938de62eb6e440b97721c5/basic.ics?_t=${timestamp}`;
    const response = await fetch(calendar_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status}`);
    }
    
    const data = await response.text();
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).send(data);
  } catch (error) {
    console.error("Calendar API Error:", error);
    res.status(500).json({ error: error.message });
  }
}
