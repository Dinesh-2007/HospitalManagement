async function run() {
  try {
    const res = await fetch("http://localhost:3000/api/Dinesh-2007/appointments?patientId=8653215762&patientName=arun+k");
    const data = await res.json();
    console.log(data);
  } catch (e) { console.error(e); }
}
run();
