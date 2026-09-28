import Workspace from '@/components/edu/workspace';
import {notFound} from 'next/navigation';
const views=['onboarding','dashboard','tutor','interview','resume','mistakes','progress','settings','help','privacy','terms'];
export default async function Page({params}:{params:Promise<{view:string}>}){const {view}=await params;if(!views.includes(view))notFound();return <Workspace view={view}/>}
