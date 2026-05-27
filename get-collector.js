// Ejecutar esto UNA SOLA VEZ para crear el store y el POS
const ACCESS_TOKEN = 'YOUR_TOKEN_HERE';

async function main() {
  // 1. Crear Store
  const storeRes = await fetch('https://api.mercadopago.com/users/me/stores', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Rappibellion', business_hours: { monday: [{ open: '00:00', close: '23:59' }] }, location: { street_number: '1', street_name: 'Digital', city_name: 'Buenos Aires', state_name: 'Buenos Aires', country: 'AR', latitude: -34.603722, longitude: -58.381592, reference: 'online' } })
  });
  const store = await storeRes.json();
  console.log('STORE:', JSON.stringify(store));

  // 2. Crear POS
  const posRes = await fetch('https://api.mercadopago.com/pos', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Web Rappibellion', fixed_amount: false, store_id: store.id, external_id: 'WEB001' })
  });
  const pos = await posRes.json();
  console.log('POS:', JSON.stringify(pos));
  console.log('COLLECTOR_ID:', pos.user_id);
}
main();
