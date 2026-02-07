// admin-config.js
const CONFIG = {
    SB_URL: "https://pkzvftleoysldqmjdgds.supabase.co",
    SB_KEY: "sb_publishable_H9QIgdBqQZtHXcywZyDsjA_s4fXffjN",
    
    // This is the hash for "KeyCraft2026"
    // To change it, you'd generate a new hash using the browser console
    ADMIN_PASSWORD_HASH: "-2014449077" 
};

// A simple hashing function to compare passwords
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return hash.toString();
}
