// Welcome overlay for user consent and microphone permissions

export function initWelcomeOverlay(onConsent) {

    const overlay = document.querySelector('#welcome-overlay');
    const button = overlay.querySelector('#grant-permission');
    button.addEventListener('click', async () => {
        try {
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false
                }
            });

            // Permission granted, clean up the test stream
            stream.getTracks().forEach(track => track.stop());

            // Remove overlay
            overlay.remove();

            // Call success callback
            onConsent(true);

        } catch (error) {
            console.error('Microphone permission denied:', error);

            // Update button to show error
            button.textContent = 'Permission Denied - Try Again';
            button.style.background = 'linear-gradient(45deg, #ff4444, #cc0000)';

            setTimeout(() => {
                onConsent(false);
            }, 2000);
        }
    });
}
