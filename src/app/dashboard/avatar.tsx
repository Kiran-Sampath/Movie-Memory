import Image from "next/image";

type AvatarProps = {
  name: string | null;
  email: string | null;
  image: string | null;
};

// Shows the Google photo when there is one, otherwise the user's initials.
export function Avatar({ name, email, image }: AvatarProps) {
  if (image) {
    return (
      <Image
        src={image}
        alt=""
        width={48}
        height={48}
        className="h-12 w-12 rounded-full"
      />
    );
  }

  return (
    <div
      aria-hidden
      className="flex h-12 w-12 items-center justify-center rounded-full bg-panel font-semibold text-muted"
    >
      {initials(name, email)}
    </div>
  );
}

// "Ada Lovelace" -> "AL", no name -> first letter of the email, nothing -> "?"
function initials(name: string | null, email: string | null): string {
  const words = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "?";
}
