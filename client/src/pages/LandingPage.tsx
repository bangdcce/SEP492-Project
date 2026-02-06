import { useNavigate } from 'react-router-dom';
import { LandingPage as LandingPageComponent } from '@/shared/components/figma/landing';
import { ROUTES } from '@/constants';

export default function LandingPage() {
    const navigate = useNavigate();

    const handleNavigateToSignIn = () => {
        navigate(ROUTES.LOGIN);
    };

    const handleNavigateToSignUp = () => {
        navigate(ROUTES.REGISTER);
    };

    return (
        <LandingPageComponent
            onNavigateToSignIn={handleNavigateToSignIn}
            onNavigateToSignUp={handleNavigateToSignUp}
        />
    );
}
