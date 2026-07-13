import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import type { AcademyInvite, AcademyRegistration, AuthUser, InvitableRole, Role, UserProfile, UserStatus } from '../types/auth';

type AuthContextValue = {
  user: AuthUser | null;
  session: Session | null;
  profile: UserProfile | null;
  userProfile: UserProfile | null;
  role: Role | null;
  loading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  refreshUserProfile: () => Promise<UserProfile | null>;
  registerAcademy: (input: { name: string; city: string; phone: string }) => Promise<string>;
  approveAcademy: (academy: AcademyRegistration) => Promise<void>;
  createAcademyCoach: (input: { name: string; email: string; phone: string }) => Promise<string>;
  createAcademyStudent: (input: { name: string; email: string; phone: string; guardianName?: string; guardianPhone?: string; guardianEmail?: string }) => Promise<string>;
  revokeInvite: (inviteId: string) => Promise<void>;
  acceptInvite: (invite: AcademyInvite) => Promise<UserProfile>;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  platform_role: string | null;
  app_role: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  linked_coach_id?: string | null;
  linked_student_id?: string | null;
  linked_parent_id?: string | null;
};

type MembershipContextRow = {
  academy_id: string;
  role: string | null;
  joined_at: string | null;
  created_at: string | null;
};

type ClaimedCoachRow = {
  id: string;
  academy_id: string;
  user_id: string | null;
  membership_id: string | null;
  email: string | null;
  status: string;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const appRoles = new Set<Role>(['super_admin', 'academy_admin', 'coach', 'parent', 'student', 'unassigned', 'user']);
const userStatuses = new Set<UserStatus>(['active', 'pending', 'disabled']);

function getProfileRouteRole(profile: UserProfile | null): Role | null {
  if (!profile) return null;
  if (profile.platform_role === 'super_admin') return 'super_admin';
  return profile.app_role;
}

function resolveRole(row: Pick<ProfileRow, 'platform_role' | 'app_role'>): Role {
  if (row.platform_role === 'super_admin') return 'super_admin';
  if (row.app_role && appRoles.has(row.app_role as Role)) return row.app_role as Role;
  return 'user';
}

function normalizeStatus(status: string | null): UserStatus {
  return status && userStatuses.has(status as UserStatus) ? status as UserStatus : 'active';
}

function getMembershipRolePriority(role: string | null) {
  if (role === 'academy_admin') return 4;
  if (role === 'coach') return 3;
  if (role === 'student') return 2;
  return 1;
}

async function getActiveAcademyId(userId: string, appRole: Role) {
  const { data, error } = await supabase
    .from('academy_memberships')
    .select('academy_id, role, joined_at, created_at, academies!inner(status)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('academies.status', 'active');

  if (error) throw error;

  const memberships = ((data ?? []) as MembershipContextRow[]).sort((left, right) => {
    const roleDelta = getMembershipRolePriority(right.role) - getMembershipRolePriority(left.role);
    if (roleDelta) return roleDelta;
    return String(right.joined_at ?? right.created_at ?? '').localeCompare(String(left.joined_at ?? left.created_at ?? ''));
  });
  const matchingRole = memberships.find((membership) => membership.role === appRole);
  return matchingRole?.academy_id ?? memberships[0]?.academy_id ?? null;
}

async function normalizeProfile(row: ProfileRow, user: AuthUser): Promise<UserProfile> {
  const name = row.full_name ?? user.user_metadata?.full_name ?? user.email ?? 'Kairoyr Direct User';
  const appRole = row.app_role && appRoles.has(row.app_role as Role) ? row.app_role as Role : 'user';
  const platformRole = row.platform_role ?? 'user';
  const academyId = platformRole === 'super_admin' ? null : await getActiveAcademyId(row.id, appRole);
  return {
    id: row.id,
    full_name: name,
    avatar_url: row.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    phone: row.phone,
    platform_role: platformRole,
    app_role: appRole,
    created_at: row.created_at,
    updated_at: row.updated_at,
    uid: row.id,
    name,
    email: (row.email ?? user.email ?? '').toLowerCase(),
    photoURL: row.avatar_url ?? user.user_metadata?.avatar_url ?? null,
    role: resolveRole(row),
    platformRole,
    appRole,
    status: normalizeStatus(row.status),
    academyId,
    linkedCoachId: row.linked_coach_id ?? null,
    linkedStudentId: row.linked_student_id ?? null,
    linkedParentId: row.linked_parent_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: null,
  };
}

async function getOrCreateUserProfile(user: AuthUser) {
  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();

  if (fetchError) throw fetchError;
  if (existingProfile) {
    await claimVerifiedCoachAccount(user);
    const { error: claimError } = await supabase.rpc('claim_pending_memberships');
    if (claimError) throw claimError;
    const { data: claimedProfile, error: claimedFetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>();
    if (claimedFetchError) throw claimedFetchError;
    return normalizeProfile(claimedProfile ?? existingProfile, user);
  }

  const newProfile = {
    id: user.id,
    email: (user.email ?? '').toLowerCase(),
    full_name: user.user_metadata?.full_name ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    platform_role: 'user',
    app_role: 'user',
    status: 'active',
  };

  const { data: createdProfile, error: insertError } = await supabase
    .from('profiles')
    .insert(newProfile)
    .select('*')
    .single<ProfileRow>();

  if (insertError) throw insertError;
  await claimVerifiedCoachAccount(user);
  const { error: claimError } = await supabase.rpc('claim_pending_memberships');
  if (claimError) throw claimError;
  const { data: claimedProfile, error: claimedFetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle<ProfileRow>();
  if (claimedFetchError) throw claimedFetchError;
  return normalizeProfile(claimedProfile ?? createdProfile, user);
}

async function claimVerifiedCoachAccount(user: AuthUser) {
  const verifiedEmail = user.email?.trim().toLowerCase() ?? '';
  const { data, error, status } = await supabase.rpc('claim_my_coach_account');
  const claimedCoaches = (data ?? []) as ClaimedCoachRow[];

  if (import.meta.env.DEV) {
    console.info('Coach account claim', {
      authenticatedUserId: user.id,
      authenticatedEmail: verifiedEmail,
      matchingPendingCoachIds: claimedCoaches.map((coach) => coach.id),
      matchingRowCount: claimedCoaches.length,
      membershipIds: claimedCoaches.map((coach) => coach.membership_id),
      rpcResponse: data,
      httpStatus: status,
      errorCode: error?.code,
      errorMessage: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
  }

  if (error) throw Object.assign(error, { status });
  if (claimedCoaches.length === 0) return [];

  const coachIds = claimedCoaches.map((coach) => coach.id);
  const membershipIds = claimedCoaches
    .map((coach) => coach.membership_id)
    .filter((membershipId): membershipId is string => Boolean(membershipId));
  const academyIds = [...new Set(claimedCoaches.map((coach) => coach.academy_id))];

  const [{ data: persistedCoaches, error: coachError }, { data: persistedMemberships, error: membershipError }] = await Promise.all([
    supabase.from('coaches').select('*').in('id', coachIds),
    supabase.from('academy_memberships').select('*').in('id', membershipIds),
  ]);
  if (coachError) throw coachError;
  if (membershipError) throw membershipError;

  // These reads refresh every coach-dependent source after the atomic claim.
  // Pages mount after profile resolution and perform their own state-setting fetch.
  const downstreamRefreshes = await Promise.all(academyIds.map(async (academyId) => {
    const [coaches, batches, students] = await Promise.all([
      supabase.from('coaches').select('*').eq('academy_id', academyId),
      supabase.from('batches').select('*, primary_coach:coaches(id, full_name, status)').eq('academy_id', academyId),
      supabase.from('students').select('*').eq('academy_id', academyId),
    ]);
    if (coaches.error) throw coaches.error;
    if (batches.error) throw batches.error;
    if (students.error) throw students.error;
    return {
      academyId,
      pendingLoginCount: (coaches.data ?? []).filter((coach) => coach.status === 'pending_login').length,
      academyCoaches: coaches.data ?? [],
      batchCoachSelectors: (coaches.data ?? []).filter((coach) => coach.status === 'active'),
      studentCoachSelectors: (coaches.data ?? []).filter((coach) => coach.status === 'active'),
      batches: batches.data ?? [],
      students: students.data ?? [],
    };
  }));

  if (import.meta.env.DEV) {
    console.info('Coach account claim persisted', {
      coaches: persistedCoaches,
      memberships: persistedMemberships,
      downstreamRefreshes,
    });
  }

  window.dispatchEvent(new CustomEvent('coach-account-claimed', { detail: downstreamRefreshes }));
  return (persistedCoaches ?? []) as ClaimedCoachRow[];
}

async function updateProfileRole(
  userId: string,
  input: {
    app_role: Role;
    status?: UserStatus;
    linked_coach_id?: string | null;
    linked_student_id?: string | null;
    linked_parent_id?: string | null;
  },
) {
  const { error } = await supabase
    .from('profiles')
    .update({
      app_role: input.app_role,
      status: input.status ?? 'active',
      linked_coach_id: input.linked_coach_id ?? null,
      linked_student_id: input.linked_student_id ?? null,
      linked_parent_id: input.linked_parent_id ?? null,
    })
    .eq('id', userId);

  if (error) throw error;
}

function makeInviteToken() {
  return Math.random().toString(36).slice(2, 12);
}

export function isInviteExpired(expiresAt: unknown) {
  if (!expiresAt) return false;
  if (typeof expiresAt === 'object' && 'toDate' in expiresAt && typeof expiresAt.toDate === 'function') {
    return expiresAt.toDate().getTime() < Date.now();
  }
  if (expiresAt instanceof Date) return expiresAt.getTime() < Date.now();
  return false;
}

async function loadFirestoreDataLayer() {
  const firestore = await import('firebase/firestore');
  const { db } = await import('../lib/firebase');
  return { ...firestore, db };
}

async function createInvite(input: { academyId: string; role: InvitableRole; email: string; linkedProfileId: string; createdByUid: string }) {
  const { collection, db, doc, serverTimestamp, setDoc, Timestamp } = await loadFirestoreDataLayer();
  const inviteRef = doc(collection(db, 'academyInvites'));
  const inviteToken = makeInviteToken();
  // TODO: Store inviteToken hash instead of raw token before production.
  await setDoc(inviteRef, {
    academyId: input.academyId,
    role: input.role,
    email: input.email.toLowerCase(),
    linkedProfileId: input.linkedProfileId,
    inviteToken,
    status: 'pending',
    createdByUid: input.createdByUid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)),
    acceptedByUid: null,
    acceptedAt: null,
  });
  return { inviteId: inviteRef.id, inviteToken };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSessionProfile = useCallback(async (activeSession: Session | null) => {
    setSession(activeSession);

    if (!activeSession?.user) {
      setUser(null);
      setUserProfile(null);
      return null;
    }

    const { data: { user: verifiedUser }, error: verifiedUserError } = await supabase.auth.getUser();
    if (verifiedUserError) throw verifiedUserError;
    if (!verifiedUser) throw new Error('Authenticated user could not be verified.');

    setUser(verifiedUser);
    const profile = await getOrCreateUserProfile(verifiedUser);
    setUserProfile(profile);
    return profile;
  }, []);

  const refreshUserProfile = useCallback(async () => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setUserProfile(null);
      return null;
    }

    setUser(userData.user);
    const profile = await getOrCreateUserProfile(userData.user);
    setUserProfile(profile);
    return profile;
  }, []);

  useEffect(() => {
    let active = true;

    const loadInitialSession = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (active) await loadSessionProfile(data.session);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitialSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      void (async () => {
        setLoading(true);
        try {
          await loadSessionProfile(activeSession);
        } finally {
          setLoading(false);
        }
      })();
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadSessionProfile]);

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
    return null;
  }, []);

  const signOutUser = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setUser(null);
    setUserProfile(null);
  }, []);

  const registerAcademy = useCallback(async (input: { name: string; city: string; phone: string }) => {
    if (!session || !user) {
      throw new Error('You must be logged in to register an academy.');
    }

    const academyName = input.name.trim();
    const academyCity = input.city.trim();
    const ownerPhone = input.phone.trim() || null;
    const { data, error, status } = await supabase.rpc('submit_academy_application', {
      academy_name: academyName,
      city: academyCity,
      owner_phone: ownerPhone,
    });
    if (error) throw Object.assign(error, { status });
    const academy = Array.isArray(data) ? data[0] : data;
    return academy?.id ?? '';
  }, [session, user]);

  const approveAcademy = useCallback(async (academy: AcademyRegistration) => {
    if (!user) {
      throw new Error('You must be logged in to approve academies.');
    }
    const { approveAcademy: approveSupabaseAcademy } = await import('../lib/academyApi');
    await approveSupabaseAcademy(academy.id);
  }, [user]);

  const createAcademyCoach = useCallback(async (input: { name: string; email: string; phone: string }) => {
    if (!user || !userProfile?.academyId) throw new Error('Only academy admins can add coaches.');
    const { createCoach } = await import('../lib/coachApi');
    const coach = await createCoach({
      academy_id: userProfile.academyId,
      full_name: input.name,
      email: input.email,
      phone: input.phone,
    });
    return coach.id;
  }, [user, userProfile?.academyId]);

  const createAcademyStudent = useCallback(async (input: { name: string; email: string; phone: string; guardianName?: string; guardianPhone?: string; guardianEmail?: string }) => {
    if (!user || !userProfile?.academyId) throw new Error('Only academy admins can add students.');
    const { createStudent } = await import('../lib/studentApi');
    const student = await createStudent({
      academy_id: userProfile.academyId,
      full_name: input.name,
      email: input.email,
      phone: input.phone,
      parent_name: input.guardianName,
      parent_email: input.guardianEmail,
      parent_phone: input.guardianPhone,
    });
    return student.id;
  }, [user, userProfile?.academyId]);

  const revokeInvite = useCallback(async (inviteId: string) => {
    const { db, doc, updateDoc } = await loadFirestoreDataLayer();
    await updateDoc(doc(db, 'academyInvites', inviteId), { status: 'revoked' });
  }, []);

  const acceptInvite = useCallback(async (invite: AcademyInvite) => {
    if (!user) throw new Error('You must sign in to accept this invite.');
    if (invite.role === 'coach') {
      throw new Error('Coach access is now linked automatically by Google email. Ask the coach to log in with the pre-authorized email.');
    }
    const signedInEmail = (user.email ?? '').toLowerCase();
    if (signedInEmail !== invite.email.toLowerCase()) {
      throw new Error(`This invite was sent to ${invite.email}. Please sign in with that Google account.`);
    }
    if (invite.status !== 'pending') throw new Error('This invite is no longer pending.');
    if (isInviteExpired(invite.expiresAt)) throw new Error('This invite has expired.');
    const { db, doc, serverTimestamp, updateDoc } = await loadFirestoreDataLayer();

    const linkedFields = {
      linkedCoachId: null,
      linkedStudentId: invite.linkedProfileId,
      linkedParentId: null,
    };
    await updateDoc(doc(db, 'users', user.id), {
      role: invite.role,
      status: 'active',
      academyId: invite.academyId,
      ...linkedFields,
      updatedAt: serverTimestamp(),
    });
    await updateProfileRole(user.id, {
      app_role: invite.role,
      status: 'active',
      linked_coach_id: null,
      linked_student_id: invite.linkedProfileId,
      linked_parent_id: null,
    });
    await updateDoc(doc(db, 'academies', invite.academyId, 'students', invite.linkedProfileId), {
      status: 'active',
      userUid: user.id,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'academyInvites', invite.id), {
      status: 'accepted',
      acceptedByUid: user.id,
      acceptedAt: serverTimestamp(),
    });
    if (userProfile) {
      const { createAuditLog } = await import('../utils/superAdminActions');
      await createAuditLog({
        actor: userProfile,
        action: 'invite.accepted',
        targetType: 'academyInvite',
        targetId: invite.id,
        academyId: invite.academyId,
        message: `${signedInEmail} accepted ${invite.role} invite.`,
        metadata: { role: invite.role, linkedProfileId: invite.linkedProfileId },
      });
    }
    const profile = await refreshUserProfile();
    if (!profile) throw new Error('Could not refresh joined profile.');
    return profile;
  }, [refreshUserProfile, user, userProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      profile: userProfile,
      userProfile,
      role: getProfileRouteRole(userProfile),
      loading,
      isAuthenticated: Boolean(session?.user),
      signInWithGoogle,
      signOut: signOutUser,
      logout: signOutUser,
      refreshProfile: refreshUserProfile,
      refreshUserProfile,
      registerAcademy,
      approveAcademy,
      createAcademyCoach,
      createAcademyStudent,
      revokeInvite,
      acceptInvite,
    }),
    [acceptInvite, approveAcademy, createAcademyCoach, createAcademyStudent, loading, refreshUserProfile, registerAcademy, revokeInvite, session, signInWithGoogle, signOutUser, user, userProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
