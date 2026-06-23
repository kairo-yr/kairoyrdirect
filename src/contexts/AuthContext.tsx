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
  academy_id?: string | null;
  linked_coach_id?: string | null;
  linked_student_id?: string | null;
  linked_parent_id?: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const appRoles = new Set<Role>(['academy_admin', 'coach', 'parent', 'student', 'unassigned', 'user']);
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

function normalizeProfile(row: ProfileRow, user: AuthUser): UserProfile {
  const name = row.full_name ?? user.user_metadata?.full_name ?? user.email ?? 'Kairoyr Direct User';
  const appRole = row.app_role && appRoles.has(row.app_role as Role) ? row.app_role as Role : 'user';
  const platformRole = row.platform_role ?? 'user';
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
    academyId: row.academy_id ?? null,
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
  if (existingProfile) return normalizeProfile(existingProfile, user);

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
  return normalizeProfile(createdProfile, user);
}

async function updateProfileRole(
  userId: string,
  input: {
    app_role: Role;
    status?: UserStatus;
    academy_id?: string | null;
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
      academy_id: input.academy_id ?? null,
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
    setUser(activeSession?.user ?? null);

    if (!activeSession?.user) {
      setUserProfile(null);
      return null;
    }

    const profile = await getOrCreateUserProfile(activeSession.user);
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
    if (!user) {
      throw new Error('You must be logged in to register an academy.');
    }
    const { createAcademy } = await import('../lib/academyApi');
    const academy = await createAcademy({
      name: input.name,
      city: input.city,
      primary_phone: input.phone,
      owner_email: (user.email ?? '').toLowerCase(),
      owner_name: userProfile?.full_name ?? user.user_metadata?.full_name ?? user.email ?? null,
      owner_phone: input.phone,
      status: 'pending',
    });
    return academy.id;
  }, [user, userProfile?.full_name]);

  const approveAcademy = useCallback(async (academy: AcademyRegistration) => {
    if (!user) {
      throw new Error('You must be logged in to approve academies.');
    }
    const { approveAcademy: approveSupabaseAcademy } = await import('../lib/academyApi');
    await approveSupabaseAcademy(academy.id);
  }, [user]);

  const createAcademyCoach = useCallback(async (input: { name: string; email: string; phone: string }) => {
    if (!user || !userProfile?.academyId) throw new Error('Only academy admins can add coaches.');
    const { collection, db, doc, serverTimestamp, setDoc } = await loadFirestoreDataLayer();
    const coachRef = doc(collection(db, 'academies', userProfile.academyId, 'coaches'));
    const invite = await createInvite({
      academyId: userProfile.academyId,
      role: 'coach',
      email: input.email,
      linkedProfileId: coachRef.id,
      createdByUid: user.id,
    });
    await setDoc(coachRef, {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      status: 'invited',
      userUid: null,
      inviteId: invite.inviteId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return invite.inviteToken;
  }, [user, userProfile?.academyId]);

  const createAcademyStudent = useCallback(async (input: { name: string; email: string; phone: string; guardianName?: string; guardianPhone?: string; guardianEmail?: string }) => {
    if (!user || !userProfile?.academyId) throw new Error('Only academy admins can add students.');
    const { collection, db, doc, serverTimestamp, setDoc } = await loadFirestoreDataLayer();
    const studentRef = doc(collection(db, 'academies', userProfile.academyId, 'students'));
    const invite = await createInvite({
      academyId: userProfile.academyId,
      role: 'student',
      email: input.email,
      linkedProfileId: studentRef.id,
      createdByUid: user.id,
    });
    await setDoc(studentRef, {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      parentName: input.guardianName ?? '',
      parentEmail: (input.guardianEmail ?? '').toLowerCase(),
      parentPhone: input.guardianPhone ?? '',
      guardianName: input.guardianName ?? '',
      guardianEmail: (input.guardianEmail ?? '').toLowerCase(),
      guardianPhone: input.guardianPhone ?? '',
      status: 'invited',
      userUid: null,
      inviteId: invite.inviteId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return invite.inviteToken;
  }, [user, userProfile?.academyId]);

  const revokeInvite = useCallback(async (inviteId: string) => {
    const { db, doc, updateDoc } = await loadFirestoreDataLayer();
    await updateDoc(doc(db, 'academyInvites', inviteId), { status: 'revoked' });
  }, []);

  const acceptInvite = useCallback(async (invite: AcademyInvite) => {
    if (!user) throw new Error('You must sign in to accept this invite.');
    const signedInEmail = (user.email ?? '').toLowerCase();
    if (signedInEmail !== invite.email.toLowerCase()) {
      throw new Error(`This invite was sent to ${invite.email}. Please sign in with that Google account.`);
    }
    if (invite.status !== 'pending') throw new Error('This invite is no longer pending.');
    if (isInviteExpired(invite.expiresAt)) throw new Error('This invite has expired.');
    const { db, doc, serverTimestamp, updateDoc } = await loadFirestoreDataLayer();

    const linkedFields = {
      linkedCoachId: invite.role === 'coach' ? invite.linkedProfileId : null,
      linkedStudentId: invite.role === 'student' ? invite.linkedProfileId : null,
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
      academy_id: invite.academyId,
      linked_coach_id: invite.role === 'coach' ? invite.linkedProfileId : null,
      linked_student_id: invite.role === 'student' ? invite.linkedProfileId : null,
      linked_parent_id: null,
    });
    const profileCollection = invite.role === 'coach' ? 'coaches' : 'students';
    await updateDoc(doc(db, 'academies', invite.academyId, profileCollection, invite.linkedProfileId), {
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
