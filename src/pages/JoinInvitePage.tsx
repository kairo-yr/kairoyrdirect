import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { CheckCircle2, LogIn, ShieldAlert } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BrandMark } from '../components/ui/BrandMark';
import { useAuth, isInviteExpired } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import type { AcademyInvite, InvitableRole } from '../types/auth';
import { getAuthRedirectPath } from '../utils/roleRedirects';

type LinkedProfile = {
  name?: string;
  email?: string;
  parentName?: string;
};

const roleLabels: Record<InvitableRole, string> = {
  coach: 'Coach',
  student: 'Student',
};

function isInvitableRole(value: string | undefined): value is InvitableRole {
  return value === 'coach' || value === 'student';
}

function profileCollection(role: InvitableRole) {
  if (role === 'coach') return 'coaches';
  return 'students';
}

export function JoinInvitePage() {
  const { role, inviteToken } = useParams();
  const navigate = useNavigate();
  const { acceptInvite, firebaseUser, loginWithGoogle } = useAuth();
  const [invite, setInvite] = useState<AcademyInvite | null>(null);
  const [academyName, setAcademyName] = useState('');
  const [profile, setProfile] = useState<LinkedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadInvite = async () => {
      setLoading(true);
      setError('');
      try {
        if (!isInvitableRole(role) || !inviteToken) {
          setError('This invite link is not valid.');
          return;
        }

        const inviteQuery = query(collection(db, 'academyInvites'), where('inviteToken', '==', inviteToken), limit(1));
        const inviteSnapshot = await getDocs(inviteQuery);
        if (inviteSnapshot.empty) {
          setError('This invite was not found.');
          return;
        }

        const loadedInvite = { id: inviteSnapshot.docs[0].id, ...inviteSnapshot.docs[0].data() } as AcademyInvite;
        if (loadedInvite.role !== role) {
          setError('This invite role does not match the link.');
          return;
        }
        if (loadedInvite.status !== 'pending') {
          setError('This invite is no longer pending.');
          return;
        }
        if (isInviteExpired(loadedInvite.expiresAt)) {
          setError('This invite has expired.');
          return;
        }

        const [academySnapshot, profileSnapshot] = await Promise.all([
          getDoc(doc(db, 'academies', loadedInvite.academyId)),
          getDoc(doc(db, 'academies', loadedInvite.academyId, profileCollection(loadedInvite.role), loadedInvite.linkedProfileId)),
        ]);

        setInvite(loadedInvite);
        setAcademyName(academySnapshot.exists() ? String(academySnapshot.data().name ?? 'Academy') : 'Academy');
        setProfile(profileSnapshot.exists() ? profileSnapshot.data() as LinkedProfile : null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load this invite.');
      } finally {
        setLoading(false);
      }
    };

    void loadInvite();
  }, [inviteToken, role]);

  const handleLogin = async () => {
    setSubmitting(true);
    setError('');
    try {
      await loginWithGoogle();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!invite) return;
    setSubmitting(true);
    setError('');
    try {
      const updatedProfile = await acceptInvite(invite);
      navigate(getAuthRedirectPath(updatedProfile), { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not accept this invite.');
    } finally {
      setSubmitting(false);
    }
  };

  const signedInEmail = firebaseUser?.email?.toLowerCase() ?? '';
  const inviteEmail = invite?.email.toLowerCase() ?? '';
  const emailMatches = Boolean(invite && signedInEmail && signedInEmail === inviteEmail);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-soft">
        <Link to="/"><BrandMark /></Link>
        {loading ? (
          <div className="mt-8 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-directBlue">Checking invite...</div>
        ) : error && !invite ? (
          <div className="mt-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <ShieldAlert size={22} />
            </div>
            <h1 className="mt-5 text-3xl font-black text-navy">Invite unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{error}</p>
          </div>
        ) : invite ? (
          <div className="mt-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 size={22} />
            </div>
            <h1 className="mt-5 text-3xl font-black text-navy">Join {academyName}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              You have been invited as <span className="font-black text-navy">{roleLabels[invite.role]}</span>{profile?.name ? ` for ${profile.name}` : ''}.
              {invite.role === 'student' ? ' A parent or guardian may use their own Google account for this student dashboard.' : ''}
            </p>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              <div><span className="font-black text-navy">Invite email:</span> {invite.email}</div>
              {profile?.parentName ? <div><span className="font-black text-navy">Guardian / Contact:</span> {profile.parentName}</div> : null}
            </div>

            {!firebaseUser ? (
              <button className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white disabled:opacity-60" disabled={submitting} onClick={handleLogin} type="button">
                <LogIn size={18} />
                {submitting ? 'Connecting...' : 'Continue with Google'}
              </button>
            ) : !emailMatches ? (
              <div className="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                This invite was sent to {invite.email}. You are signed in as {firebaseUser.email}. Please sign in with the invited Google account.
              </div>
            ) : (
              <button className="mt-6 w-full rounded-2xl bg-directBlue px-4 py-3 text-sm font-black text-white disabled:opacity-60" disabled={submitting} onClick={handleAccept} type="button">
                {submitting ? 'Joining...' : 'Accept Invite'}
              </button>
            )}
            {error ? <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
