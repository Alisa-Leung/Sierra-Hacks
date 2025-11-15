//checks if user is in a meeting
function isInMeeting(){
    const meetingPattern = /meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}/;
    return meetingPattern.test(window.location.href);
}

function notifyMeetingEntry(){
    chrome.runtime.sendMessage({action: "openPopup"});
}
if (isInMeeting()){
    setTimeout(notifyMeetingEntry, 2000);
}
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl){
        lastUrl = url;
        if (isInMeeting()){
            setTimeout(notifyMeetingEntry, 2000);
        }
    }
}).observe(document, {subtree: true, childList: true});