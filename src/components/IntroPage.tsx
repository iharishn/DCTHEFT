import Spline from '@splinetool/react-spline';
import './IntroPage.css';

interface IntroPageProps {
    onEnter: () => void;
}

export function IntroPage({ onEnter }: IntroPageProps) {
    return (
        <div className="intro-wrap" onClick={onEnter}>
            <div className="spline-scale">
                <Spline scene="https://prod.spline.design/EKZ7BRGyyTHhawy9/scene.splinecode" />
            </div>
        </div>
    );
}
