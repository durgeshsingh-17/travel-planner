import { PrismaClient, FuelType, PlaceCategory, VehicleType } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const locations = [
    {
      name: 'Delhi',
      slug: 'delhi',
      state: 'Delhi',
      latitude: 28.6139,
      longitude: 77.209
    },
    {
      name: 'Gurgaon',
      slug: 'gurgaon',
      state: 'Haryana',
      latitude: 28.4595,
      longitude: 77.0266
    },
    {
      name: 'Gurugram',
      slug: 'gurugram',
      state: 'Haryana',
      latitude: 28.4595,
      longitude: 77.0266
    },
    {
      name: 'Noida',
      slug: 'noida',
      state: 'Uttar Pradesh',
      latitude: 28.5355,
      longitude: 77.391
    },
    {
      name: 'Mumbai',
      slug: 'mumbai',
      state: 'Maharashtra',
      latitude: 19.076,
      longitude: 72.8777
    },
    {
      name: 'Pune',
      slug: 'pune',
      state: 'Maharashtra',
      latitude: 18.5204,
      longitude: 73.8567
    },
    {
      name: 'Bengaluru',
      slug: 'bengaluru',
      state: 'Karnataka',
      latitude: 12.9716,
      longitude: 77.5946
    },
    {
      name: 'Jaipur',
      slug: 'jaipur',
      state: 'Rajasthan',
      latitude: 26.9124,
      longitude: 75.7873
    },
    {
      name: 'Udaipur',
      slug: 'udaipur',
      state: 'Rajasthan',
      latitude: 24.5854,
      longitude: 73.7125
    },
    {
      name: 'Chandigarh',
      slug: 'chandigarh',
      state: 'Chandigarh',
      latitude: 30.7333,
      longitude: 76.7794
    },
    {
      name: 'Dehradun',
      slug: 'dehradun',
      state: 'Uttarakhand',
      latitude: 30.3165,
      longitude: 78.0322
    },
    {
      name: 'Rishikesh',
      slug: 'rishikesh',
      state: 'Uttarakhand',
      latitude: 30.0869,
      longitude: 78.2676
    },
    {
      name: 'Manali',
      slug: 'manali',
      state: 'Himachal Pradesh',
      latitude: 32.2432,
      longitude: 77.1892
    },
    {
      name: 'Jibhi',
      slug: 'jibhi',
      state: 'Himachal Pradesh',
      latitude: 31.5964,
      longitude: 77.3511
    },
    {
      name: 'Goa',
      slug: 'goa',
      state: 'Goa',
      latitude: 15.2993,
      longitude: 74.124
    },
    {
      name: 'Chennai',
      slug: 'chennai',
      state: 'Tamil Nadu',
      latitude: 13.0827,
      longitude: 80.2707
    }
  ];

  for (const location of locations) {
    await prisma.location.upsert({
      where: {
        slug: location.slug
      },
      update: location,
      create: location
    });
  }

  const vehicles = [
    {
        brand: 'Honda',
        model: 'CB350',
        type: VehicleType.BIKE,
        fuelType: FuelType.PETROL,
        engineCc: 348,
        tankCapacity: 15,
        averageMileage: 32
      },
      {
        brand: 'Mahindra',
        model: 'Thar',
        type: VehicleType.CAR,
        fuelType: FuelType.DIESEL,
        engineCc: 2184,
        tankCapacity: 57,
        averageMileage: 14
      },
      {
        brand: 'Tata',
        model: 'Nexon EV',
        type: VehicleType.EV,
        fuelType: FuelType.ELECTRIC,
        tankCapacity: null,
        averageMileage: null
      }
  ];

  for (const vehicle of vehicles) {
    const existingVehicle = await prisma.vehicle.findFirst({
      where: {
        brand: vehicle.brand,
        model: vehicle.model
      }
    });

    if (!existingVehicle) {
      await prisma.vehicle.create({ data: vehicle });
    }
  }

  const jibhi = await prisma.destination.upsert({
    where: { slug: 'jibhi' },
    update: {},
    create: {
      name: 'Jibhi',
      slug: 'jibhi',
      state: 'Himachal Pradesh',
      country: 'India',
      latitude: 31.5964,
      longitude: 77.3511,
      shortDescription:
        'A quiet Himachal valley base for Jalori Pass, Serolsar Lake, forest walks and slow cafe evenings.',
      heroImageUrl:
        'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1600&q=85',
      bestTimeToVisit: 'March to June, October to November'
    }
  });

  const rishikesh = await prisma.destination.upsert({
    where: { slug: 'rishikesh' },
    update: {},
    create: {
      name: 'Rishikesh',
      slug: 'rishikesh',
      state: 'Uttarakhand',
      country: 'India',
      latitude: 30.0869,
      longitude: 78.2676,
      shortDescription:
        'River views, rafting, yoga, forest roads and weekend-friendly drives from Delhi NCR.',
      heroImageUrl:
        'https://images.unsplash.com/photo-1588084603723-41322210d3f6?auto=format&fit=crop&w=1600&q=85',
      bestTimeToVisit: 'October to April'
    }
  });

  await prisma.place.createMany({
    data: [
      {
        destinationId: jibhi.id,
        name: 'Jalori Pass',
        slug: 'jalori-pass',
        category: PlaceCategory.VIEWPOINT,
        description: 'A high mountain pass with sweeping valley views and dramatic road sections.',
        latitude: 31.5694,
        longitude: 77.3854,
        averageVisitMinutes: 90,
        estimatedCost: 0,
        rating: 4.7
      },
      {
        destinationId: jibhi.id,
        name: 'Serolsar Lake',
        slug: 'serolsar-lake',
        category: PlaceCategory.ATTRACTION,
        description: 'Forest trail leading to a peaceful alpine lake near Jalori Pass.',
        latitude: 31.5837,
        longitude: 77.3976,
        averageVisitMinutes: 180,
        estimatedCost: 300,
        rating: 4.6
      },
      {
        destinationId: jibhi.id,
        name: 'Jibhi Waterfall',
        slug: 'jibhi-waterfall',
        category: PlaceCategory.ATTRACTION,
        description: 'Short walk to a small waterfall tucked inside cedar forest.',
        latitude: 31.6014,
        longitude: 77.3516,
        averageVisitMinutes: 60,
        estimatedCost: 50,
        rating: 4.4
      },
      {
        destinationId: rishikesh.id,
        name: 'Triveni Ghat',
        slug: 'triveni-ghat',
        category: PlaceCategory.ATTRACTION,
        description: 'Riverside ghat known for evening aarti and peaceful walks.',
        latitude: 30.1012,
        longitude: 78.2941,
        averageVisitMinutes: 90,
        estimatedCost: 0,
        rating: 4.5
      }
    ],
    skipDuplicates: true
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
