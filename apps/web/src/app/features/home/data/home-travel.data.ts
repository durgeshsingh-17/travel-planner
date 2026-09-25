import { MoodCard, TravelCard } from '../models/travel-card.model';

export const trendingRoadTrips: TravelCard[] = [
  {
    title: 'Gurgaon to Jibhi',
    subtitle: 'Cedar forests, river stays and Jalori Pass.',
    imageUrl:
      'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=900&q=80',
    meta: '3 days • 520 km',
    tag: 'Mountain'
  },
  {
    title: 'Bengaluru to Coorg',
    subtitle: 'Coffee estates, misty roads and slow mornings.',
    imageUrl:
      'https://images.unsplash.com/photo-1609766418204-94aae0ecf9fb?auto=format&fit=crop&w=900&q=80',
    meta: '2 days • 270 km',
    tag: 'Weekend'
  },
  {
    title: 'Mumbai to Goa',
    subtitle: 'Konkan coastline, seafood stops and beach sunsets.',
    imageUrl:
      'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=900&q=80',
    meta: '4 days • 590 km',
    tag: 'Beach'
  },
  {
    title: 'Jaipur to Udaipur',
    subtitle: 'Fort towns, lake views and desert highways.',
    imageUrl:
      'https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?auto=format&fit=crop&w=900&q=80',
    meta: '3 days • 395 km',
    tag: 'Heritage'
  }
];

export const popularDestinations: TravelCard[] = [
  {
    title: 'Manali',
    subtitle: 'Snow views, cafes, hikes and Himachal road culture.',
    imageUrl:
      'https://images.unsplash.com/photo-1626621331169-5f34be280ed9?auto=format&fit=crop&w=900&q=80',
    meta: 'Best Oct-Jun',
    tag: 'Himachal'
  },
  {
    title: 'Munnar',
    subtitle: 'Tea gardens, valley drives and cool weather.',
    imageUrl:
      'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=900&q=80',
    meta: 'Best Sep-Mar',
    tag: 'Kerala'
  },
  {
    title: 'Rishikesh',
    subtitle: 'River stays, rafting, yoga and forest roads.',
    imageUrl:
      'https://images.unsplash.com/photo-1588084603723-41322210d3f6?auto=format&fit=crop&w=900&q=80',
    meta: 'Best Oct-Apr',
    tag: 'Uttarakhand'
  }
];

export const budgetTrips: TravelCard[] = [
  {
    title: 'Delhi to Rishikesh',
    subtitle: 'A quick reset with river walks and cafe hopping.',
    imageUrl:
      'https://images.unsplash.com/photo-1598091383021-15ddea10925d?auto=format&fit=crop&w=900&q=80',
    meta: 'Under Rs 8,000',
    tag: 'Budget'
  },
  {
    title: 'Pune to Mahabaleshwar',
    subtitle: 'Hill roads, viewpoints and strawberry stops.',
    imageUrl:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80',
    meta: 'Under Rs 6,500',
    tag: 'Weekend'
  },
  {
    title: 'Chennai to Pondicherry',
    subtitle: 'ECR drive, French quarters and easy beaches.',
    imageUrl:
      'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=900&q=80',
    meta: 'Under Rs 9,000',
    tag: 'Coastal'
  }
];

export const moodCards: MoodCard[] = [
  { label: 'Bike Trips', description: 'Open roads and scenic detours' },
  { label: 'Mountains', description: 'Cold air, passes and pine roads' },
  { label: 'Beaches', description: 'Coastal drives and late sunsets' },
  { label: 'Adventure', description: 'Rafting, hikes and active days' },
  { label: 'Family', description: 'Comfortable routes and balanced days' },
  { label: 'Couples', description: 'Quiet stays and slower mornings' },
  { label: 'Spiritual', description: 'Temples, ghats and peaceful towns' },
  { label: 'Nature', description: 'Forests, lakes and wildlife routes' }
];
