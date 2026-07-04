import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResultCardQuickActions } from './ResultCardQuickActions';
import type { Place } from '@/lib/api';

function buildPlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'place-1',
    displayName: { text: 'Acme Inc' },
    formattedAddress: 'Av Paulista, 1000',
    nationalPhoneNumber: '+5511999999999',
    websiteUri: 'https://acme.example',
    rating: 4.5,
    userRatingCount: 100,
    primaryType: 'restaurant',
    businessStatus: 'OPERATIONAL',
    ...overrides,
  } as Place;
}

describe('ResultCardQuickActions', () => {
  it('renders all action buttons', () => {
    const onViewDetails = vi.fn();
    render(<ResultCardQuickActions place={buildPlace()} onViewDetails={onViewDetails} />);
    expect(screen.getByLabelText(/Ligar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ver no mapa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/WhatsApp/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Ver detalhes/i)).toBeInTheDocument();
  });

  it('calls onViewDetails when details button clicked', () => {
    const onViewDetails = vi.fn();
    render(<ResultCardQuickActions place={buildPlace()} onViewDetails={onViewDetails} />);
    screen.getByLabelText(/Ver detalhes/i).click();
    expect(onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('calls onActionClick with correct action names', () => {
    const onActionClick = vi.fn();
    const onViewDetails = vi.fn();
    render(<ResultCardQuickActions place={buildPlace()} onViewDetails={onViewDetails} onActionClick={onActionClick} />);
    screen.getByLabelText(/Ligar/i).click();
    expect(onActionClick).toHaveBeenCalledWith('CALL_CLICK');
  });

  it('does not render phone link when no phone available', () => {
    const place = buildPlace({ nationalPhoneNumber: undefined, internationalPhoneNumber: undefined });
    render(<ResultCardQuickActions place={place} onViewDetails={() => {}} />);
    expect(screen.queryByLabelText(/Ligar/i)).not.toBeInTheDocument();
  });

  it('does not render whatsapp when no phone', () => {
    const place = buildPlace({ nationalPhoneNumber: undefined, internationalPhoneNumber: undefined });
    render(<ResultCardQuickActions place={place} onViewDetails={() => {}} />);
    expect(screen.queryByLabelText(/WhatsApp/i)).not.toBeInTheDocument();
  });
});
