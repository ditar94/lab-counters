function showTime() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
    const timeNow = customDateTime = new Date().toLocaleString('en-US', options);
    document.getElementById('clock').textContent = timeNow;
}

setInterval(showTime, 1000);

