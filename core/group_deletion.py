from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q

from core.models import Child, GalleryItem, Post, RecurringPayment, SpecialActivity
from communication.models import Message


def _delete_post_images(posts_qs):
    for post in posts_qs.only('image'):
        if post.image:
            post.image.delete(save=False)


def _delete_gallery_media(gallery_items_qs):
    for gallery_item in gallery_items_qs.prefetch_related('images').only('id'):
        for image in gallery_item.images.all():
            if image.image:
                image.image.delete(save=False)


@transaction.atomic
def delete_group_with_related_data(group):
    """
    Hard-delete group with all required related data.

    Rules:
    - Delete children in the group (and all child-dependent records via CASCADE).
    - Delete group-targeted posts and gallery items.
    - Remove group from special activities; delete activity if it no longer targets any group.
    - Delete parent accounts only when they are pure parent accounts and will have no children left.
    """
    User = get_user_model()

    group_id = group.id
    children_in_group = Child.objects.filter(group_id=group_id)
    child_ids = list(children_in_group.values_list('id', flat=True))

    candidate_parent_ids = set(
        User.objects.filter(child__id__in=child_ids).values_list('id', flat=True).distinct()
    )

    posts_for_group = Post.objects.filter(target_group_id=group_id)
    _delete_post_images(posts_for_group)
    posts_for_group.delete()

    gallery_for_group = GalleryItem.objects.filter(target_group_id=group_id)
    _delete_gallery_media(gallery_for_group)
    gallery_for_group.delete()

    # Keep activities that are also assigned to other groups.
    activities_for_group = SpecialActivity.objects.filter(groups__id=group_id).distinct()
    for activity in activities_for_group:
        activity.groups.remove(group)
        if not activity.groups.exists():
            activity.delete()

    children_in_group.delete()

    if candidate_parent_ids:
        deletable_parent_ids = list(
            User.objects.filter(
                id__in=candidate_parent_ids,
                is_parent=True,
                is_director=False,
                is_teacher=False,
            )
            .filter(child__isnull=True)
            .values_list('id', flat=True)
        )

        if deletable_parent_ids:
            # Explicit delete is enough for messages due CASCADE, but this makes intent obvious.
            Message.objects.filter(
                Q(sender_id__in=deletable_parent_ids) | Q(receiver_id__in=deletable_parent_ids)
            ).delete()
            User.objects.filter(id__in=deletable_parent_ids).delete()

    RecurringPayment.objects.filter(children__isnull=True).delete()

    group.delete()
