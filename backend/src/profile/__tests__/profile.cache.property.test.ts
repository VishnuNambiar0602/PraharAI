/**
 * Property-based tests for Profile Service Cache Invalidation
 * Using fast-check for property testing
 */

import fc from 'fast-check';
import { ProfileService } from '../profile.service';
import { ProfileUpdateInput } from '../types';
import { Driver } from 'neo4j-driver';
import { initializeNeo4j } from '../../db/neo4j.config';
import { getCacheService } from '../../cache/cache.service';

describe('Profile Service Cache Invalidation Property Tests', () => {
  let profileService: ProfileService;
  let driver: Driver;
  let cacheService: ReturnType<typeof getCacheService>;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize Neo4j connection
    const neo4jConnection = initializeNeo4j({
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password',
    });
    await neo4jConnection.connect();
    driver = neo4jConnection.getDriver();

    // Initialize cache service
    cacheService = getCacheService();
    await cacheService.initialize();

    profileService = new ProfileService(driver);
  });

  beforeEach(async () => {
    // Create a test user for each test
    testUserId = `test-user-${Date.now()}-${Math.random()}`;
    const session = driver.session();
    try {
      await session.run(
        `CREATE (u:User {
          userId: $userId,
          email: $email,
          passwordHash: 'test-hash',
          emailVerified: false,
          firstName: 'Test',
          lastName: 'User',
          dateOfBirth: datetime('1990-01-01'),
          age: 34,
          gender: 'male',
          maritalStatus: 'single',
          familySize: 1,
          annualIncome: 500000,
          incomeLevel: 'low',
          employmentStatus: 'employed',
          occupation: 'Engineer',
          occupationCategory: 'technology',
          state: 'Karnataka',
          district: 'Bangalore',
          pincode: '560001',
          ruralUrban: 'urban',
          educationLevel: 'graduate',
          caste: 'general',
          religion: null,
          disability: false,
          disabilityType: null,
          userGroups: [],
          createdAt: datetime(),
          updatedAt: datetime(),
          lastLoginAt: datetime(),
          profileCompleteness: 87
        })`,
        { userId: testUserId, email: `${testUserId}@test.com` }
      );
    } finally {
      await session.close();
    }

    // Clear cache before each test
    await cacheService.clear();
  });

  afterEach(async () => {
    // Clean up test user
    const session = driver.session();
    try {
      await session.run('MATCH (u:User {userId: $userId}) DETACH DELETE u', {
        userId: testUserId,
      });
    } finally {
      await session.close();
    }
  });

  afterAll(async () => {
    await cacheService.close();
    await driver.close();
  });

  /**
   * Property 22: Recommendation Invalidation on Profile Update
   *
   * **Validates: Requirements 8.5**
   *
   * For any user profile update, the cached recommendations for that user
   * should be invalidated, and subsequent recommendation requests should
   * generate fresh results.
   */
  describe('Property 22: Recommendation Invalidation on Profile Update', () => {
    it('should invalidate recommendations cache on any profile update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc
            .record({
              firstName: fc.option(fc.string({ minLength: 2, maxLength: 50 }), { nil: undefined }),
              lastName: fc.option(fc.string({ minLength: 2, maxLength: 50 }), { nil: undefined }),
              annualIncome: fc.option(fc.integer({ min: 0, max: 10000000 }), { nil: undefined }),
              occupation: fc.option(fc.string({ minLength: 3, maxLength: 50 }), { nil: undefined }),
            })
            .filter((updates) => {
              // Ensure at least one field is being updated
              return Object.values(updates).some((v) => v !== undefined);
            }),
          async (updates) => {
            // Set up cached recommendations
            const cachedRecommendations = [
              { schemeId: 'scheme1', schemeName: 'Test Scheme 1', relevanceScore: 0.9 },
              { schemeId: 'scheme2', schemeName: 'Test Scheme 2', relevanceScore: 0.8 },
            ];
            await cacheService.set(`recommendations:${testUserId}`, cachedRecommendations, 3600);

            // Verify cache exists before update
            const cachedBefore = await cacheService.get(`recommendations:${testUserId}`);
            expect(cachedBefore).not.toBeNull();

            // Update profile
            await profileService.updateProfile(testUserId, updates);

            // Verify recommendations cache was invalidated
            const cachedAfter = await cacheService.get(`recommendations:${testUserId}`);
            expect(cachedAfter).toBeNull();

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should invalidate user groups cache on profile update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            annualIncome: fc.integer({ min: 0, max: 10000000 }),
            occupation: fc.string({ minLength: 3, maxLength: 50 }),
          }),
          async (updates) => {
            // Set up cached user groups
            const cachedGroups = ['group1', 'group2', 'group3'];
            await cacheService.set(`user_groups:${testUserId}`, cachedGroups, 3600);

            // Verify cache exists before update
            const cachedBefore = await cacheService.get(`user_groups:${testUserId}`);
            expect(cachedBefore).not.toBeNull();

            // Update profile
            await profileService.updateProfile(testUserId, updates);

            // Verify user groups cache was invalidated
            const cachedAfter = await cacheService.get(`user_groups:${testUserId}`);
            expect(cachedAfter).toBeNull();

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should invalidate classification cache on profile update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            state: fc.constantFrom('Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi'),
            district: fc.string({ minLength: 3, maxLength: 50 }),
          }),
          async (updates) => {
            // Set up cached classification
            const cachedClassification = {
              groups: ['group1', 'group2'],
              confidence: 0.85,
              features: [0.1, 0.2, 0.3],
            };
            await cacheService.set(`classification:${testUserId}`, cachedClassification, 3600);

            // Verify cache exists before update
            const cachedBefore = await cacheService.get(`classification:${testUserId}`);
            expect(cachedBefore).not.toBeNull();

            // Update profile
            await profileService.updateProfile(testUserId, updates);

            // Verify classification cache was invalidated
            const cachedAfter = await cacheService.get(`classification:${testUserId}`);
            expect(cachedAfter).toBeNull();

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should invalidate all eligibility scores on profile update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            familySize: fc.integer({ min: 1, max: 10 }),
            educationLevel: fc.constantFrom(
              'no_formal' as const,
              'primary' as const,
              'secondary' as const,
              'higher_secondary' as const,
              'graduate' as const,
              'postgraduate' as const
            ),
          }),
          async (updates: any) => {
            // Set up cached eligibility scores for multiple schemes
            const schemeIds = ['scheme1', 'scheme2', 'scheme3'];
            for (const schemeId of schemeIds) {
              await cacheService.set(
                `eligibility:${testUserId}:${schemeId}`,
                { score: 0.75, percentage: 75 },
                3600
              );
            }

            // Verify caches exist before update
            for (const schemeId of schemeIds) {
              const cached = await cacheService.get(`eligibility:${testUserId}:${schemeId}`);
              expect(cached).not.toBeNull();
            }

            // Update profile
            await profileService.updateProfile(testUserId, updates);

            // Verify all eligibility caches were invalidated
            for (const schemeId of schemeIds) {
              const cached = await cacheService.get(`eligibility:${testUserId}:${schemeId}`);
              expect(cached).toBeNull();
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should invalidate cache even for minor profile updates', async () => {
      // Test that even small updates trigger cache invalidation
      const minorUpdates: ProfileUpdateInput = {
        firstName: 'NewName',
      };

      // Set up all caches
      await cacheService.set(`recommendations:${testUserId}`, ['rec1'], 3600);
      await cacheService.set(`user_groups:${testUserId}`, ['group1'], 3600);
      await cacheService.set(`classification:${testUserId}`, { data: 'test' }, 3600);
      await cacheService.set(`eligibility:${testUserId}:scheme1`, { score: 0.8 }, 3600);

      // Verify all caches exist
      expect(await cacheService.get(`recommendations:${testUserId}`)).not.toBeNull();
      expect(await cacheService.get(`user_groups:${testUserId}`)).not.toBeNull();
      expect(await cacheService.get(`classification:${testUserId}`)).not.toBeNull();
      expect(await cacheService.get(`eligibility:${testUserId}:scheme1`)).not.toBeNull();

      // Update profile with minor change
      await profileService.updateProfile(testUserId, minorUpdates);

      // Verify all caches were invalidated
      expect(await cacheService.get(`recommendations:${testUserId}`)).toBeNull();
      expect(await cacheService.get(`user_groups:${testUserId}`)).toBeNull();
      expect(await cacheService.get(`classification:${testUserId}`)).toBeNull();
      expect(await cacheService.get(`eligibility:${testUserId}:scheme1`)).toBeNull();
    });

    it('should not affect other users caches on profile update', async () => {
      // Create another test user
      const otherUserId = `other-user-${Date.now()}`;
      const session = driver.session();
      try {
        await session.run(
          `CREATE (u:User {
            userId: $userId,
            email: $email,
            passwordHash: 'test-hash',
            emailVerified: false,
            firstName: 'Other',
            lastName: 'User',
            dateOfBirth: datetime('1985-01-01'),
            age: 39,
            gender: 'female',
            maritalStatus: 'married',
            familySize: 3,
            annualIncome: 800000,
            incomeLevel: 'middle',
            employmentStatus: 'employed',
            occupation: 'Teacher',
            occupationCategory: 'education',
            state: 'Maharashtra',
            district: 'Mumbai',
            pincode: '400001',
            ruralUrban: 'urban',
            educationLevel: 'postgraduate',
            caste: 'general',
            religion: null,
            disability: false,
            disabilityType: null,
            userGroups: [],
            createdAt: datetime(),
            updatedAt: datetime(),
            lastLoginAt: datetime(),
            profileCompleteness: 93
          })`,
          { userId: otherUserId, email: `${otherUserId}@test.com` }
        );

        // Set up caches for both users
        await cacheService.set(`recommendations:${testUserId}`, ['rec1'], 3600);
        await cacheService.set(`recommendations:${otherUserId}`, ['rec2'], 3600);

        // Update first user's profile
        await profileService.updateProfile(testUserId, { firstName: 'Updated' });

        // Verify first user's cache was invalidated
        expect(await cacheService.get(`recommendations:${testUserId}`)).toBeNull();

        // Verify other user's cache was NOT affected
        const otherUserCache = await cacheService.get(`recommendations:${otherUserId}`);
        expect(otherUserCache).not.toBeNull();
        expect(otherUserCache).toEqual(['rec2']);

        // Cleanup other user
        await session.run('MATCH (u:User {userId: $userId}) DETACH DELETE u', {
          userId: otherUserId,
        });
      } finally {
        await session.close();
      }
    });
  });
});
