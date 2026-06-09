import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "./queryClient";
import { useAuth } from "./auth";
import { useToast } from "@/hooks/use-toast";

const firstName = (n?: string) => (n || "").trim().split(/\s+/)[0] || "Crew";

// "Crew up with X": create a free squad and pull a matched connection straight in,
// then drop you into the group's campsite chat. Used from Matches + Profile.
export function useCrewUp() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (connection: { id: string; name: string }) => {
      const res = await apiRequest("POST", "/api/groups", {
        name: `${firstName(user?.name)} & ${firstName(connection.name)}`,
        type: "squad",
        visibility: "closed",
      });
      const group = await res.json();
      await apiRequest("POST", `/api/groups/${group.id}/invite-connection`, { userId: connection.id });
      return group;
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/my-led"] });
      toast({ title: "Squad started! 🏕️", description: "Add more of your crew from inside." });
      navigate(`/groups/${group.id}?tab=campsite`);
    },
    onError: (e: any) => toast({ title: e?.message?.replace(/^\d+:\s*/, "") || "Couldn't start the squad", variant: "destructive" }),
  });
}
