import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore,
  persistentLocalCache, 
  persistentMultipleTabManager,
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// 1. Inicialize o app Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/* 2. Inicialize o Firestore com cache local ativado para múltiplas abas (IndexedDB)
 * Isto garante que todos os dados fiquem salvos localmente no dispositivo (Android, iOS Safari, Windows)
 * e continuem acessíveis e editáveis mesmo sem nenhuma conexão com a internet.
 */
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  // Se já foi inicializado (re-renders ou hot reload), reutiliza a instância
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Solicita ao navegador permissão de Armazenamento Persistente.
 * No iOS (Safari) e Chrome/Android, isso impede que o sistema operacional
 * limpe o cache de dados e o IndexedDB por inatividade (regra de 7 dias do Safari)
 * ou sob baixa memória de disco.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window !== 'undefined' && 'storage' in navigator && navigator.storage?.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[Frota NRE] Armazenamento persistente no dispositivo: ${isPersisted ? 'ATIVADO' : 'NÃO CONCEDIDO'}`);
      return isPersisted;
    } catch (err) {
      console.warn('[Frota NRE] Não foi possível solicitar armazenamento persistente:', err);
      return false;
    }
  }
  return false;
}

// Executa automaticamente a solicitação de armazenamento persistente
if (typeof window !== 'undefined') {
  requestPersistentStorage().catch(() => {});
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.log("[Frota NRE] App em modo offline - Dados sendo carregados e salvos no cache local.");
    }
  }
}

// Auto-run connection test on boot
if (typeof window !== 'undefined') {
  testConnection().catch(() => {});
}

export { signInWithPopup, signOut, onAuthStateChanged };
export type { User };
