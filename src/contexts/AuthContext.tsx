import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { collection, doc, getDocs, limit, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, getDoc } from 'firebase/firestore';
import { SUPER_ADMIN_EMAILS } from '../constants/superAdmin';
import { auth, db } from '../lib/firebase';
import type { AcademyInvite, AcademyRegistration, FirebaseUser, InvitableRole, Role, UserProfile } from '../types/auth';
import { createAuditLog } from '../utils/superAdminActions';

type AuthContextValue = {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  role: Role | null;
  loading: boolean;
  isAuthenticated: boolean;
  loginWithGoogle: () => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  refreshUserProfile: () => Promise<UserProfile | null>;
  registerAcademy: (input: { name: string; city: string; phone: string }) => Promise<string>;
  approveAcademy: (academy: AcademyRegistration) => Promise<void>;
  createAcademyCoach: (input: { name: string; email: string; phone: string }) => Promise<string>;
  createAcademyStudent: (input: { name: string; email: string; phone: string; parentName: string; parentEmail: string }) => Promise<string>;
  revokeInvite: (inviteId: string) => Promise<void>;
  acceptInvite: (invite: AcademyInvite) => Promise<UserProfile>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const provider = new GoogleAuthProvider();

function isSuperAdminEmail(email: string | null) {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.map((item) => item.toLowerCase()).includes(email.toLowerCase());
}

function normalizeProfile(data: Partial<UserProfile>, uid: string): UserProfile {
  return {
    uid,
    name: data.name ?? '',
    email: data.email ?? '',
    photoURL: data.photoURL ?? null,
    role: data.role ?? 'unassigned',
    academyId: data.academyId ?? null,
    linkedCoachId: data.linkedCoachId ?? null,
    linkedStudentId: data.linkedStudentId ?? null,
    linkedParentId: data.linkedParentId ?? null,
    status: data.status ?? 'pending',
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    lastLoginAt: data.lastLoginAt ?? null,
  };
}

async function getOrCreateUserProfile(user: FirebaseUser) {
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    const isSuperAdmin = isSuperAdminEmail(user.email);
    await updateDoc(userRef, {
      name: user.displayName ?? snapshot.data().name ?? user.email ?? 'Kairoyr Direct User',
      photoURL: user.photoURL,
      ...(isSuperAdmin ? { role: 'super_admin', status: 'active', academyId: null } : {}),
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const updatedSnapshot = await getDoc(userRef);
    return normalizeProfile(updatedSnapshot.data() as Partial<UserProfile>, user.uid);
  }

  const isSuperAdmin = isSuperAdminEmail(user.email);
  const role: Role = isSuperAdmin ? 'super_admin' : 'unassigned';
  const status = isSuperAdmin ? 'active' : 'pending';
  const profile = {
    uid: user.uid,
    name: user.displayName ?? user.email ?? 'Kairoyr Direct User',
    email: (user.email ?? '').toLowerCase(),
    photoURL: user.photoURL,
    role,
    academyId: null,
    linkedCoachId: null,
    linkedStudentId: null,
    linkedParentId: null,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  };

  await setDoc(userRef, profile);
  const createdSnapshot = await getDoc(userRef);
  return normalizeProfile(createdSnapshot.data() as Partial<UserProfile>, user.uid);
}

function makeInviteToken() {
  return Math.random().toString(36).slice(2, 12);
}

export function isInviteExpired(expiresAt: unknown) {
  if (!expiresAt) return false;
  if (expiresAt instanceof Timestamp) return expiresAt.toDate().getTime() < Date.now();
  if (expiresAt instanceof Date) return expiresAt.getTime() < Date.now();
  return false;
}

async function createInvite(input: { academyId: string; role: InvitableRole; email: string; linkedProfileId: string; createdByUid: string }) {
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
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setUserProfile(null);
      return null;
    }

    const profile = await getOrCreateUserProfile(auth.currentUser);
    setUserProfile(profile);
    return profile;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setFirebaseUser(user);

      try {
        if (user) {
          const profile = await getOrCreateUserProfile(user);
          setUserProfile(profile);
        } else {
          setUserProfile(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, provider);
    const profile = await getOrCreateUserProfile(result.user);
    setFirebaseUser(result.user);
    setUserProfile(profile);
    return profile;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setFirebaseUser(null);
    setUserProfile(null);
  }, []);

  const registerAcademy = useCallback(async (input: { name: string; city: string; phone: string }) => {
    if (!auth.currentUser) {
      throw new Error('You must be logged in to register an academy.');
    }
    const academyRef = doc(collection(db, 'academies'));
    await setDoc(academyRef, {
      name: input.name,
      city: input.city,
      phone: input.phone,
      ownerUid: auth.currentUser.uid,
      ownerEmail: (auth.currentUser.email ?? '').toLowerCase(),
      status: 'pending',
      createdAt: serverTimestamp(),
      approvedAt: null,
      approvedBy: null,
    });
    return academyRef.id;
  }, []);

  const approveAcademy = useCallback(async (academy: AcademyRegistration) => {
    if (!auth.currentUser) {
      throw new Error('You must be logged in to approve academies.');
    }

    await updateDoc(doc(db, 'academies', academy.id), {
      status: 'active',
      approvedAt: serverTimestamp(),
      approvedBy: auth.currentUser.uid,
    });
    await updateDoc(doc(db, 'users', academy.ownerUid), {
      role: 'academy_admin',
      status: 'active',
      academyId: academy.id,
      updatedAt: serverTimestamp(),
    });
  }, []);

  const createAcademyCoach = useCallback(async (input: { name: string; email: string; phone: string }) => {
    if (!auth.currentUser || !userProfile?.academyId) throw new Error('Only academy admins can add coaches.');
    const coachRef = doc(collection(db, 'academies', userProfile.academyId, 'coaches'));
    const invite = await createInvite({
      academyId: userProfile.academyId,
      role: 'coach',
      email: input.email,
      linkedProfileId: coachRef.id,
      createdByUid: auth.currentUser.uid,
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
  }, [userProfile?.academyId]);

  const createAcademyStudent = useCallback(async (input: { name: string; email: string; phone: string; parentName: string; parentEmail: string }) => {
    if (!auth.currentUser || !userProfile?.academyId) throw new Error('Only academy admins can add students.');
    const studentRef = doc(collection(db, 'academies', userProfile.academyId, 'students'));
    const invite = await createInvite({
      academyId: userProfile.academyId,
      role: 'student',
      email: input.email,
      linkedProfileId: studentRef.id,
      createdByUid: auth.currentUser.uid,
    });
    await setDoc(studentRef, {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      parentName: input.parentName,
      parentEmail: input.parentEmail.toLowerCase(),
      status: 'invited',
      userUid: null,
      inviteId: invite.inviteId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return invite.inviteToken;
  }, [userProfile?.academyId]);

  const revokeInvite = useCallback(async (inviteId: string) => {
    await updateDoc(doc(db, 'academyInvites', inviteId), { status: 'revoked' });
  }, []);

  const acceptInvite = useCallback(async (invite: AcademyInvite) => {
    if (!auth.currentUser) throw new Error('You must sign in to accept this invite.');
    const signedInEmail = (auth.currentUser.email ?? '').toLowerCase();
    if (signedInEmail !== invite.email.toLowerCase()) {
      throw new Error(`This invite was sent to ${invite.email}. Please sign in with that Google account.`);
    }
    if (invite.status !== 'pending') throw new Error('This invite is no longer pending.');
    if (isInviteExpired(invite.expiresAt)) throw new Error('This invite has expired.');

    const linkedFields = {
      linkedCoachId: invite.role === 'coach' ? invite.linkedProfileId : null,
      linkedStudentId: invite.role === 'student' ? invite.linkedProfileId : null,
      linkedParentId: invite.role === 'parent' ? invite.linkedProfileId : null,
    };
    await updateDoc(doc(db, 'users', auth.currentUser.uid), {
      role: invite.role,
      status: 'active',
      academyId: invite.academyId,
      ...linkedFields,
      updatedAt: serverTimestamp(),
    });
    const profileCollection = invite.role === 'coach' ? 'coaches' : invite.role === 'student' ? 'students' : 'parents';
    await updateDoc(doc(db, 'academies', invite.academyId, profileCollection, invite.linkedProfileId), {
      status: 'active',
      userUid: auth.currentUser.uid,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'academyInvites', invite.id), {
      status: 'accepted',
      acceptedByUid: auth.currentUser.uid,
      acceptedAt: serverTimestamp(),
    });
    if (userProfile) {
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
  }, [refreshUserProfile, userProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      userProfile,
      role: userProfile?.role ?? null,
      loading,
      isAuthenticated: Boolean(firebaseUser),
      loginWithGoogle,
      logout,
      refreshUserProfile,
      registerAcademy,
      approveAcademy,
      createAcademyCoach,
      createAcademyStudent,
      revokeInvite,
      acceptInvite,
    }),
    [acceptInvite, approveAcademy, createAcademyCoach, createAcademyStudent, firebaseUser, loading, loginWithGoogle, logout, refreshUserProfile, registerAcademy, revokeInvite, userProfile],
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
