const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testAPI() {
  try {
    console.log('Testing parse-event API...\n');
    
    const { default: fetchFn } = await import('node-fetch');
    const response = await fetchFn('http://localhost:3001/parse-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: 'Toplantı Daveti: Proje Lansmanı - Yarın 14:00',
        body: 'Merhaba, Proje lansman toplantısı yarın (12 Mart 2026) saat 14:00-15:30 arasında yapılacak. Yer: Konferans Salonu A. Lütfen zamanında geliniz.',
        from: 'ahmet@ornek.com',
        date: '2026-03-11T10:00:00Z'
      })
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testAPI();
