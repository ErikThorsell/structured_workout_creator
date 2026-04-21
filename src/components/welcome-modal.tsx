const STORAGE_KEY = 'swb-welcome-seen';

export function hasSeenWelcome(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function markWelcomeSeen(): void {
  localStorage.setItem(STORAGE_KEY, 'true');
}

interface WelcomeModalProps {
  onClose: () => void;
}

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  const handleClose = () => {
    markWelcomeSeen();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-lg font-bold text-gray-800">Welcome to Structured Workout Builder</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 shrink-0 text-xl leading-none"
            >
              ✕
            </button>
          </div>

          <Section title="Building a workout">
            <p>
              <strong>Route mode</strong> -- import a GPX file and divide the route into segments.
              Set a power target, intensity, and notes for each segment. Use repeat blocks for
              intervals (e.g. 4&times; threshold + recovery). Export both a <strong>FIT workout</strong>
              and a <strong>GPX course</strong> with waypoints at each segment boundary.
            </p>
            <p>
              <strong>Free mode</strong> -- no route needed. Add segments with time, distance, or
              lap-button durations and assign power targets. Exports a FIT workout only.
            </p>
          </Section>

          <Section title="On the bike">
            <Steps>
              <Step>
                Start the <strong>course</strong> on your device for turn-by-turn navigation and
                the map view.
              </Step>
              <Step>
                Start the <strong>workout</strong> separately. Both run simultaneously -- the course
                handles navigation, the workout handles power targets.
              </Step>
              <Step>
                As you approach a segment boundary, a <strong>course point alert</strong> pops up
                on screen with the upcoming segment name and target.
              </Step>
              <Step>
                Workout steps advance <strong>automatically by distance</strong>. If a segment is
                set to <em>lap button</em>, press lap manually at the landmark.
              </Step>
            </Steps>
          </Section>

          <div className="pt-2">
            <button
              onClick={handleClose}
              className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Got it, let's build a workout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
      <div className="text-sm text-gray-600 space-y-2">{children}</div>
    </div>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-1.5 list-decimal list-outside ml-4">{children}</ol>;
}

function Step({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-gray-600">{children}</li>;
}
